import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, CreditCard } from "lucide-react";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { migrateUnscopedData } from "@/lib/localAuth";
import { createTrialSubscription, TRIAL_DAYS, PLAN_NAMES } from "@/lib/subscription";
import type { PlanId, BillingPeriod } from "@/lib/subscription";
import { redirectToStripeCheckout } from "@/lib/api/stripe";

// Activates the trial from today so waiting for the email didn't burn trial days
function activateTrialIfNeeded(email: string) {
  try {
    const key = `${email}:estimate_subscription`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const sub = JSON.parse(raw);
    if (sub.trialActivatedAt || sub.activePlan !== "trial") return;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
    localStorage.setItem(key, JSON.stringify({ ...sub, trialActivatedAt: new Date().toISOString(), trialEndsAt }));
  } catch { /* non-fatal */ }
}

const PLANS: PlanId[] = ["starter", "pro", "business"];

const SetupPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [planId, setPlanId] = useState<PlanId>("pro");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  // Set when user came from "subscribe now" on pricing page — skip trial, go straight to Stripe
  const [directCheckout] = useState(() => !!localStorage.getItem('metricore_direct_plan'));

  // Detect the Supabase session that the invite link injects
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsReady(true);
        setUserEmail(session.user.email ?? "");
        setUserName(session.user.user_metadata?.displayName ?? "");
      }
    });

    // Also check if a session is already active (page reload after link click)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsReady(true);
        setUserEmail(session.user.email ?? "");
        setUserName(session.user.user_metadata?.displayName ?? "");
        const meta = session.user.user_metadata ?? {};
        // Prefer localStorage direct-checkout intent over user metadata
        const directPlan = localStorage.getItem('metricore_direct_plan') as PlanId | null;
        const directBilling = localStorage.getItem('metricore_direct_billing') as BillingPeriod | null;
        if (directPlan && PLANS.includes(directPlan)) setPlanId(directPlan);
        else if (PLANS.includes(meta.plan_id)) setPlanId(meta.plan_id);
        if (directBilling === 'annual') setBillingPeriod('annual');
        else if (meta.billing_period === "annual") setBillingPeriod("annual");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setupAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const meta = user?.user_metadata ?? {};
    const resolvedPlan: PlanId = PLANS.includes(meta.plan_id) ? meta.plan_id : planId;
    const resolvedBilling: BillingPeriod = meta.billing_period === "annual" ? "annual" : billingPeriod;
    const email = user?.email ?? userEmail;
    const displayName = meta.displayName ?? userName ?? email.split("@")[0];
    createTrialSubscription(email, displayName, resolvedPlan, resolvedBilling);
    migrateUnscopedData(email);
    activateTrialIfNeeded(email);
    return { resolvedPlan, resolvedBilling };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { resolvedPlan, resolvedBilling } = await setupAccount();

      if (directCheckout) {
        // Clear the direct-checkout flags before going to Stripe
        localStorage.removeItem('metricore_direct_plan');
        localStorage.removeItem('metricore_direct_billing');
        await redirectToStripeCheckout(resolvedPlan, resolvedBilling);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      localStorage.setItem(`${user?.email ?? userEmail}:show_welcome`, "true");
      toast.success("Welcome to Metricore. Your account is ready!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Could not set password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribeNow = async () => {
    if (password.length < 8) { toast.error("Set your password first (min 8 characters)"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    setIsCheckingOut(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const { resolvedPlan, resolvedBilling } = await setupAccount();
      await redirectToStripeCheckout(resolvedPlan, resolvedBilling);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong. Please try again.");
      setIsCheckingOut(false);
    }
  };

  // No session yet — invite link not clicked or expired
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero py-12">
        <div className="container mx-auto px-6 max-w-md">
          <Card className="p-8 shadow-xl text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <MetricoreLogoMark height={34} />
              <span className="font-display text-xl font-bold">Metricore</span>
            </div>
            <h1 className="font-display text-2xl font-bold">Waiting for your link…</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Please click the <strong>Set Up Your Account</strong> button in the email we sent you.
              <br />
              The link expires in 24 hours.
            </p>
            <p className="text-xs text-muted-foreground">
              Can't find it? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-primary hover:underline"
              >
                return to sign in
              </button>
              .
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero py-12">
      <div className="container mx-auto px-6 max-w-md">
        <Card className="p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-center gap-2">
            <MetricoreLogoMark height={34} />
            <span className="font-display text-xl font-bold">Metricore</span>
          </div>

          <div className="text-center">
            <div className="w-14 h-14 bg-green-50 dark:bg-green-950/30 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-1">
              {userName ? `Welcome, ${userName.split(" ")[0]}!` : "Welcome!"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Create your password to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                maxLength={100}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                maxLength={100}
              />
            </div>

            {directCheckout ? (
              /* Direct-subscribe mode — primary CTA goes straight to Stripe */
              <>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading || isCheckingOut}>
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</>
                    : <><CreditCard className="mr-2 h-4 w-4" />Subscribe to {PLAN_NAMES[planId]}</>}
                </Button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading || isCheckingOut}
                  onClick={async () => {
                    localStorage.removeItem('metricore_direct_plan');
                    localStorage.removeItem('metricore_direct_billing');
                    // Fall through to trial path
                    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
                    if (password !== confirm) { toast.error("Passwords don't match"); return; }
                    setIsLoading(true);
                    try {
                      const { error } = await supabase.auth.updateUser({ password });
                      if (error) throw error;
                      await setupAccount();
                      const { data: { user } } = await supabase.auth.getUser();
                      localStorage.setItem(`${user?.email ?? userEmail}:show_welcome`, "true");
                      toast.success("Welcome to Metricore. Your account is ready!");
                      navigate("/dashboard");
                    } catch (err: any) {
                      toast.error(err.message ?? "Could not set password. Please try again.");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  Start {TRIAL_DAYS}-Day Free Trial instead
                </Button>
              </>
            ) : (
              /* Normal trial mode */
              <>
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading || isCheckingOut}>
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</>
                    : `Start My ${TRIAL_DAYS}-Day Free Trial`}
                </Button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={isLoading || isCheckingOut}
                  onClick={handleSubscribeNow}
                >
                  {isCheckingOut
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
                    : <><CreditCard className="h-4 w-4" />Subscribe to {PLAN_NAMES[planId]} and skip the trial</>}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Skip the trial and go straight to your paid plan
                </p>
              </>
            )}
          </form>

          {userEmail && (
            <p className="text-center text-xs text-muted-foreground">
              Signing in as <strong>{userEmail}</strong>
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SetupPassword;
