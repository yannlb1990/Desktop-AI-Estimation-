import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { supabase } from "@/integrations/supabase/client";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const accept = async () => {
      // Wait briefly for Supabase to establish the session from the magic link
      await new Promise((r) => setTimeout(r, 1500));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus("error");
        setMessage("Session not found. Please use the invite link from your email.");
        return;
      }

      try {
        const res = await fetch(`${FUNCTIONS_URL}/team-accept-invite`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const body = await res.json();

        if (!res.ok) {
          setStatus("error");
          setMessage(body.error ?? "Failed to accept invite");
          return;
        }

        // Sync subscription so dashboard access is immediate
        await syncSubscriptionFromDB();
        setStatus("success");

        setTimeout(() => navigate("/dashboard"), 2500);
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message ?? "Something went wrong");
      }
    };

    accept();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4 text-center">
      <MetricoreLogoMark className="h-10 w-auto" />

      {status === "loading" && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Activating your team membership…</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h1 className="font-display text-3xl font-bold">Welcome to the team!</h1>
          <p className="text-muted-foreground max-w-sm">
            Your account is now active with Business plan access. Redirecting to your dashboard…
          </p>
          <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="h-16 w-16 text-destructive" />
          <h1 className="font-display text-2xl font-bold">Invite not found</h1>
          <p className="text-muted-foreground max-w-sm">{message}</p>
          <Button variant="outline" onClick={() => navigate("/auth")}>
            Sign in instead
          </Button>
        </>
      )}
    </div>
  );
};

export default AcceptInvite;
