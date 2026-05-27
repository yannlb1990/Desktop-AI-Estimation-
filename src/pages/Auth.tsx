import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Check, ArrowLeft, Mail, Phone, Building2, Home } from "lucide-react";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { z } from "zod";
import {
  PlanId, BillingPeriod,
  PLAN_NAMES, PLAN_PRICES, TRIAL_DAYS,
} from "@/lib/subscription";
import { localSignIn, isSignedIn, migrateUnscopedData } from "@/lib/localAuth";
import { supabase } from "@/integrations/supabase/client";

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

  // Verification states
  const [verificationSent, setVerificationSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Listen for Supabase auth state change (email confirmation callback)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at && session.user.email) {
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        migrateUnscopedData(session.user.email);
        activateTrialIfNeeded(session.user.email);
        toast.success("Email verified — welcome aboard!");
        navigate("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

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

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const data = leadSchema.parse({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        projectType,
      });

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-onboard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            phone: data.phone,
            project_type: data.projectType,
            plan_id: selectedPlan,
            billing_period: billing,
          }),
        }
      );

      if (res.status === 409) {
        toast.error("That email is already registered — please sign in instead");
        setIsLogin(true);
        setEmail(email.trim());
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Something went wrong — please try again");
        return;
      }

      setPendingEmail(data.email);
      setVerificationSent(true);
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
            <p className="text-center text-muted-foreground text-sm mb-6">
              {isLogin
                ? "Sign in to your account"
                : `${TRIAL_DAYS} days free · No credit card required · Setup link sent to your email`}
            </p>

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
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading || !projectType}
                >
                  {isLoading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending your link…</>
                    : `Get Started — ${TRIAL_DAYS}-Day Free Trial`}
                </Button>
              </form>
            )}

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setEmail(""); setPassword(""); setName(""); setPhone(""); setProjectType("");
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
            By continuing you agree to our Terms of Service &amp; Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
