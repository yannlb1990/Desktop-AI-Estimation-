import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'syncing' | 'success' | 'failed'>('syncing');
  const [retrying, setRetrying] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = async () => {
    const ok = await syncSubscriptionFromDB(3);
    if (ok) {
      setStatus('success');
      redirectTimer.current = setTimeout(() => navigate("/dashboard"), 3000);
    } else {
      setStatus('failed');
    }
  };

  useEffect(() => {
    runSync();
    return () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    setStatus('syncing');
    await runSync();
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
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h1 className="font-display text-3xl font-bold">You're all set!</h1>
          <p className="text-muted-foreground max-w-sm">
            Your subscription is now active. Redirecting to your dashboard…
          </p>
          <Button className="bg-primary text-primary-foreground" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </>
      )}

      {status === 'failed' && (
        <>
          <AlertTriangle className="h-14 w-14 text-amber-400" />
          <h1 className="font-display text-2xl font-bold">Payment received</h1>
          <p className="text-muted-foreground max-w-sm">
            Your payment went through but we couldn't confirm your plan right now.
            Try refreshing — if the issue persists, contact <strong>support@metricore.com.au</strong>.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRetry} disabled={retrying}>
              <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
              Retry
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
