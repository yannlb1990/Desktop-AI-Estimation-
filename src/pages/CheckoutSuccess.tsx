import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";

const CheckoutSuccess = () => {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    // Sync the paid subscription from DB into localStorage so ProtectedRoute
    // immediately sees the active plan without needing a page refresh.
    syncSubscriptionFromDB().finally(() => {
      setSyncing(false);
      // Auto-redirect after giving the user a moment to read the confirmation
      const timer = setTimeout(() => navigate("/dashboard"), 3000);
      return () => clearTimeout(timer);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4 text-center">
      <MetricoreLogoMark className="h-10 w-auto" />

      {syncing ? (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Activating your subscription…</p>
        </>
      ) : (
        <>
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h1 className="font-display text-3xl font-bold">You're all set!</h1>
          <p className="text-muted-foreground max-w-sm">
            Your subscription is now active. You'll be redirected to your dashboard in a moment.
          </p>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => navigate("/dashboard")}
          >
            Go to Dashboard
          </Button>
        </>
      )}
    </div>
  );
};

export default CheckoutSuccess;
