import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";
import { PLAN_NAMES, PLAN_PRICES, PlanId } from "@/lib/subscription";

const PLAN_FEATURES: Record<PlanId, string[]> = {
  starter: [
    "Up to 3 active projects",
    "PDF plan upload and manual measurements",
    "Cost estimation across all trades",
  ],
  pro: [
    "Unlimited projects",
    "BOQ CSV and SOW PDF exports",
    "AI Plan Analyser",
    "Market Insights and Materials Library",
    "Takeoff PDF and annotated plan reports",
  ],
  business: [
    "Everything in Professional",
    "Up to 5 team seats",
    "Priority support",
  ],
};

// Fire Google Ads conversion once — only if env vars are set
let conversionFired = false;
function fireGoogleAdsConversion(planId: PlanId, billing: "monthly" | "annual") {
  if (conversionFired) return;
  conversionFired = true;
  const gadsId = import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined;
  const gadsLabel = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_LABEL as string | undefined;
  if (!gadsId || !gadsLabel) return;
  const gtag = (window as Record<string, unknown>).gtag as ((...args: unknown[]) => void) | undefined;
  if (typeof gtag !== "function") return;
  const value = PLAN_PRICES[planId]?.[billing] ?? 149;
  gtag("event", "conversion", {
    send_to: `${gadsId}/${gadsLabel}`,
    value,
    currency: "AUD",
    transaction_id: `${planId}_${billing}_${Date.now()}`,
  });
}

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = (searchParams.get("plan") ?? "pro") as PlanId;
  const billing = (searchParams.get("billing") ?? "monthly") as "monthly" | "annual";

  const [status, setStatus] = useState<"syncing" | "success" | "slow">("syncing");
  const [retrying, setRetrying] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = () => {
    let t = 5;
    setCountdown(t);
    timerRef.current = setInterval(() => {
      t -= 1;
      setCountdown(t);
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        navigate("/dashboard");
      }
    }, 1000);
  };

  const runSync = async (attempts = 10) => {
    const ok = await syncSubscriptionFromDB(attempts);
    fireGoogleAdsConversion(planId, billing);
    if (ok) {
      setStatus("success");
      startCountdown();
    } else {
      setStatus("slow");
      timerRef.current = setTimeout(() => navigate("/dashboard"), 6000) as unknown as ReturnType<typeof setInterval>;
    }
  };

  useEffect(() => {
    runSync();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleRetry = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRetrying(true);
    setStatus("syncing");
    await runSync(5);
    setRetrying(false);
  };

  const planName = PLAN_NAMES[planId] ?? "Professional";
  const features = PLAN_FEATURES[planId] ?? PLAN_FEATURES.pro;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-8">

        <MetricoreLogoMark className="h-10 w-auto mx-auto" />

        {status === "syncing" && (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Activating your subscription...</p>
          </div>
        )}

        {(status === "success" || status === "slow") && (
          <>
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-primary" />
                </div>
              </div>

              <div>
                <h1 className="font-display text-3xl font-bold mb-2">
                  {status === "success" ? "You're all set!" : "Payment confirmed!"}
                </h1>
                <p className="text-muted-foreground">
                  Your{" "}
                  <span className="text-foreground font-semibold">{planName}</span>{" "}
                  plan is{" "}
                  {status === "success" ? "now active." : "activating now."}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 text-left space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                What's included in {planName}
              </p>
              <ul className="space-y-2.5">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {status === "slow" && (
              <p className="text-sm text-muted-foreground">
                Your plan will be ready in a few moments. If it doesn't activate, refresh the dashboard.
              </p>
            )}

            {status === "success" ? (
              <div className="space-y-3">
                <Button
                  className="w-full bg-primary text-primary-foreground"
                  onClick={() => navigate("/dashboard")}
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  Redirecting in {countdown}s
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleRetry} disabled={retrying}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? "animate-spin" : ""}`} />
                  Check again
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground"
                  onClick={() => navigate("/dashboard")}
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default CheckoutSuccess;
