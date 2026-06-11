import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Check, ArrowLeft, Mail, Phone, Building2, Home, CreditCard } from "lucide-react";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { z } from "zod";
import {
  PlanId, BillingPeriod,
  PLAN_NAMES, PLAN_PRICES, TRIAL_DAYS, createTrialSubscription,
} from "@/lib/subscription";
import { localSignIn, isSignedIn, migrateUnscopedData } from "@/lib/localAuth";
import { supabase } from "@/integrations/supabase/client";
import { onboardUser } from "@/lib/api/auth";
import { EdgeFunctionError } from "@/lib/api/client";

// Resets the trial end date to 14 days from now on the user's first real sign-in,
// so the clock doesn't count down the days they spent waiting to verify their email.
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

const leadSchema = z.object({
  name: z.string().min(1, "Full name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().min(6, "Phone number is required").max(30),
  projectType: z.enum(["commercial", "residential"], { required_error: "Please select a project type" }),
});

const signInSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(1, "Password is required").max(100),
});

const PLANS: PlanId[] = ["starter", "pro", "business"];
const PLAN_TAGLINES: Record<PlanId, string> = {
  starter:  "$79/mo · 3 projects",
  pro:      "$149/mo · Unlimited · Most popular",
  business: "$279/mo · 5 team seats",
};

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Prevents both handleSignIn and onAuthStateChange from navigating simultaneously
  const navigatedRef = useRef(false);

  const planParam = (params.get("plan") as PlanId | null) || "pro";
  const billingParam = (params.get("billing") as BillingPeriod | null) || "monthly";
  const modeParam = params.get("mode");

  const [isLogin, setIsLogin] = useState(modeParam !== "signup");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(
    PLANS.includes(planParam) ? planParam : "pro"
  );
  const [billing] = useState<BillingPeriod>(billingParam);

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [projectType, setProjectType] = useState<"commercial" | "residential" | "">("");
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Verification states
  const [verificationSent, setVerificationSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Listen for Supabase auth state change (email confirmation + Google OAuth callback)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at && session.user.email) {
        if (navigatedRef.current) return;
        navigatedRef.current = true;

        const email = session.user.email;
        migrateUnscopedData(email);

        // New Google OAuth user — no subscription exists yet, create trial
        const subKey = `${email}:estimate_subscription`;
        if (!localStorage.getItem(subKey)) {
          const oauthPlan = (localStorage.getItem('metricore_oauth_plan') as PlanId) || selectedPlan;
          const oauthBilling = (localStorage.getItem('metricore_oauth_billing') as BillingPeriod) || billing;
          const displayName =
            session.user.user_metadata?.full_name ??
            session.user.user_metadata?.name ??
            email.split('@')[0];
          createTrialSubscription(email, displayName, oauthPlan, oauthBilling);
          localStorage.setItem(`${email}:show_welcome`, "true");
        }

        localStorage.removeItem('metricore_oauth_plan');
        localStorage.removeItem('metricore_oauth_billing');

        activateTrialIfNeeded(email);
        toast.success("Welcome to Metricore!");
        navigate("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, selectedPlan, billing]);

  // Already signed in? Go straight to dashboard
  useEffect(() => {
    if (isSignedIn()) navigate("/dashboard");
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNeedsVerification(false);

    try {
      const data = signInSchema.parse({ email: email.trim(), password });
      const result = await localSignIn(data.email, data.password);

      if (result.needsVerification) {
        setPendingEmail(data.email);
        setNeedsVerification(true);
        toast.error("Please verify your email first — check your inbox");
        return;
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (navigatedRef.current) return;
      navigatedRef.current = true;
      migrateUnscopedData(data.email);
      activateTrialIfNeeded(data.email);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Something went wrong — please try again");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitRequest = async (direct: boolean) => {
    setIsLoading(true);

    // Set or clear direct-checkout intent before submitting
    if (direct) {
      localStorage.setItem('metricore_direct_plan', selectedPlan);
      localStorage.setItem('metricore_direct_billing', billing);
    } else {
      localStorage.removeItem('metricore_direct_plan');
      localStorage.removeItem('metricore_direct_billing');
    }

    try {
      const data = leadSchema.parse({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        projectType,
      });

      await onboardUser({
        name: data.name,
        email: data.email,
        phone: data.phone,
        project_type: data.projectType,
        plan_id: selectedPlan,
        billing_period: billing,
        marketing_consent: marketingConsent,
      });

      setPendingEmail(data.email);
      setVerificationSent(true);
    } catch (error) {
      if (direct) {
        localStorage.removeItem('metricore_direct_plan');
        localStorage.removeItem('metricore_direct_billing');
      }
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof EdgeFunctionError && error.status === 409) {
        toast.error("That email is already registered — please sign in instead");
        setIsLogin(true);
        setEmail(email.trim());
      } else if (error instanceof EdgeFunctionError) {
        toast.error(error.message);
      } else {
        toast.error("Something went wrong — please try again");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestAccess = (e: React.FormEvent) => {
    e.preventDefault();
    submitRequest(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first");
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      toast.error("Couldn't send reset email — try again in a moment");
    } else {
      toast.success("Password reset email sent — check your inbox");
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    setResendLoading(false);
    if (error) {
      toast.error("Couldn't resend — try again in a moment");
    } else {
      toast.success("Verification email resent!");
    }
  };

  const price = PLAN_PRICES[selectedPlan][billing];

  // Check-your-email screen (shown after signup)
  if (verificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero py-12">
        <div className="container mx-auto px-6">
          <div className="max-w-md mx-auto">
            <Card className="p-8 shadow-xl text-center space-y-5">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/30 rounded-full flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold mb-2">Check your inbox</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We sent a setup link to{" "}
                  <strong className="text-foreground">{pendingEmail}</strong>.
                  <br />
                  Click <strong>"Set Up Your Account"</strong> in the email to create your password and access your {TRIAL_DAYS}-day free trial. Link expires in 24 hours.
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                >
                  {resendLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Resend verification email
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setVerificationSent(false);
                    setIsLogin(true);
                    setEmail(pendingEmail);
                    setPassword(""); setName(""); setPhone(""); setProjectType("");
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </Card>
            <p className="text-center mt-4 text-sm text-white/50">
              Didn't receive it? Check your spam folder.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero py-12">
      <div className="container mx-auto px-6">
        <div className="max-w-md mx-auto">

          <Button
            variant="ghost"
            className="mb-6 text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to home
          </Button>

          <Card className="p-8 shadow-xl">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <MetricoreLogoMark height={34} />
              <span className="font-display text-xl font-bold">Metricore</span>
            </div>

            <h1 className="font-display text-2xl font-bold text-center mb-1">
              {isLogin ? "Welcome back" : "Start your free trial"}
            </h1>
            <p className="text-center text-muted-foreground text-sm mb-3">
              {isLogin
                ? "Sign in to your account"
                : `${TRIAL_DAYS} days free · No credit card required`}
            </p>

            {/* Selected plan badge — signup only */}
            {!isLogin && (
              <div className="flex justify-center mb-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                  <Check className="h-3 w-3" />
                  {PLAN_NAMES[selectedPlan]} plan selected · ${PLAN_PRICES[selectedPlan][billing]} AUD/mo after trial
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or continue with email</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Needs verification reminder */}
            {needsVerification && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
                <Mail className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                  <p className="font-medium">Email not verified</p>
                  <p>Check your inbox for a verification link.</p>
                  {pendingEmail && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="text-amber-700 dark:text-amber-300 underline hover:no-underline"
                    >
                      {resendLoading ? "Resending…" : "Resend verification email"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Plan selector (signup only) */}
            {!isLogin && (
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Select your plan (free trial on all)
                </p>
                <div className="space-y-2">
                  {PLANS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPlan(p)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all ${
                        selectedPlan === p
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {selectedPlan === p
                          ? <Check className="h-4 w-4 text-primary" />
                          : <span className="w-4 h-4 rounded-full border border-border" />}
                        <span className="font-medium">{PLAN_NAMES[p]}</span>
                        {p === "pro" && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Popular</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{PLAN_TAGLINES[p]}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  After trial: ${price} AUD/mo
                </p>
              </div>
            )}

            {/* ── Sign In form ─────────────────────────────────────────── */}
            {isLogin && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="builder@example.com.au"
                    required
                    maxLength={255}
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    maxLength={100}
                  />
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetLoading}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      {resetLoading ? "Sending…" : "Forgot password?"}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                    : "Sign In"}
                </Button>
              </form>
            )}

            {/* ── Lead capture form (signup) ────────────────────────────── */}
            {!isLogin && (
              <form onSubmit={handleRequestAccess} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    required
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="email-signup">Email Address</Label>
                  <Input
                    id="email-signup"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com.au"
                    required
                    maxLength={255}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="04XX XXX XXX"
                      required
                      maxLength={30}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label>Project Type</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(["commercial", "residential"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setProjectType(type)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                          projectType === type
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {type === "commercial"
                          ? <Building2 className="h-4 w-4 shrink-0" />
                          : <Home className="h-4 w-4 shrink-0" />}
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary shrink-0"
                  />
                  <span className="text-xs text-muted-foreground leading-snug group-hover:text-foreground transition-colors">
                    I'd like to receive product updates, tips, and industry insights from Metricore.
                    You can unsubscribe at any time. (Optional)
                  </span>
                </label>

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading || !projectType}
                >
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending your link…</>
                    : `Get Started — ${TRIAL_DAYS}-Day Free Trial`}
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
                  disabled={isLoading || !projectType}
                  onClick={() => submitRequest(true)}
                >
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending your link…</>
                    : <><CreditCard className="h-4 w-4" />Subscribe to {PLAN_NAMES[selectedPlan]} — ${price}/mo</>}
                </Button>

                {/* What happens next */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>
                    We'll send a setup link to your email. Click it to create your password
                    and access your {TRIAL_DAYS}-day trial instantly — no credit card needed.
                  </span>
                </div>
              </form>
            )}

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setEmail(""); setPassword(""); setName(""); setPhone(""); setProjectType(""); setMarketingConsent(false);
                  setNeedsVerification(false);
                }}
                className="text-sm text-primary hover:underline"
              >
                {isLogin
                  ? "No account yet? Sign up free"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </Card>

          <p className="text-center mt-4 text-sm text-white/50">
            By continuing you agree to our{" "}
            <a href="/terms" className="underline hover:text-white/80">Terms of Service</a>
            {" "}&amp;{" "}
            <a href="/privacy" className="underline hover:text-white/80">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
