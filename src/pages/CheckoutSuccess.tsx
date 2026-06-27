import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'syncing' | 'success' | 'slow'>('syncing');
  const [retrying, setRetrying] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = async (attempts = 10) => {
    const ok = await syncSubscriptionFromDB(attempts);
    if (ok) {
      setStatus('success');
      redirectTimer.current = setTimeout(() => navigate("/dashboard"), 3000);
    } else {
      // Payment went through — subscription will activate once webhook arrives.
      // Navigate to dashboard anyway; it will re-sync on load.
      setStatus('slow');
      redirectTimer.current = setTimeout(() => navigate("/dashboard"), 5000);
    }
  };

  useEffect(() => {
    runSync();
    return () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); };
  }, []);

  const handleRetry = async () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
    setRetrying(true);
    setStatus('syncing');
    await runSync(5);
    setRetrying(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4 text-center">
      <MetricoreLogoMark className="h-10 w-auto" />

      {status === 'syncing' && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Activating your subscription…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle className="h-16 w-16 text-[#E1DCC9]/80" />
          <h1 className="font-display text-3xl font-bold">You're all set!</h1>
          <p className="text-muted-foreground max-w-sm">
            Your subscription is now active. Redirecting to your dashboard…
          </p>
          <Button className="bg-primary text-primary-foreground" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </>
      )}

      {status === 'slow' && (
        <>
          <CheckCircle className="h-16 w-16 text-[#E1DCC9]/80" />
          <h1 className="font-display text-2xl font-bold">Payment confirmed!</h1>
          <p className="text-muted-foreground max-w-sm">
            Your subscription is activating. This can take a few moments.
            Redirecting you now; your plan will be ready shortly.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRetry} disabled={retrying}>
              <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
              Check again
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CheckoutSuccess;
