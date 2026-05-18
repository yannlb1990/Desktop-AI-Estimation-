import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { migrateUnscopedData } from "@/lib/localAuth";
import { createTrialSubscription, TRIAL_DAYS } from "@/lib/subscription";
import type { PlanId, BillingPeriod } from "@/lib/subscription";
import { TRIAL_DAYS as _TRIAL_DAYS } from "@/lib/subscription";

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
  const [isReady, setIsReady] = useState(false); // session detected
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

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
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }

    setIsLoading(true);
    try {
      // Set the user's password
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Read plan from user metadata (stored by user-onboard Edge Function)
      const { data: { user } } = await supabase.auth.getUser();
      const meta = user?.user_metadata ?? {};
      const planId: PlanId = PLANS.includes(meta.plan_id) ? meta.plan_id : "pro";
      const billing: BillingPeriod = meta.billing_period === "annual" ? "annual" : "monthly";
      const email = user?.email ?? userEmail;
      const displayName = meta.displayName ?? userName ?? email.split("@")[0];

      // Create trial subscription record in localStorage
      createTrialSubscription(email, displayName, planId, billing);
      migrateUnscopedData(email);
      activateTrialIfNeeded(email);

      toast.success("Welcome to Metricore — your account is ready!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Could not set password — please try again");
    } finally {
      setIsLoading(false);
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
              Create your password to access your {TRIAL_DAYS}-day free trial.
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
                minLength={6}
                maxLength={100}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters</p>
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up your account…</>
                : "Set Password & Enter Dashboard"}
            </Button>
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
