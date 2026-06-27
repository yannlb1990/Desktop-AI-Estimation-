import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";
import { supabase } from "@/integrations/supabase/client";
import { syncSubscriptionFromDB } from "@/lib/stripeCheckout";
import { acceptTeamInvite } from "@/lib/api/team";
import { EdgeFunctionError } from "@/lib/api/client";

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const accept = async () => {
      // Wait for Supabase to exchange the invite token for a session.
      // Check immediately first; fall back to onAuthStateChange with an 8s timeout.
      const session = await new Promise<import("@supabase/supabase-js").Session | null>((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 8000);
        supabase.auth.getSession().then(({ data }) => {
          if (data.session && !resolved) { resolved = true; clearTimeout(timeout); resolve(data.session); }
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
          if (s && !resolved) { resolved = true; clearTimeout(timeout); subscription.unsubscribe(); resolve(s); }
        });
      });

      if (!session) {
        setStatus("error");
        setMessage("Session not found. Please use the invite link from your email.");
        return;
      }

      try {
        await acceptTeamInvite();
        // Sync subscription so dashboard access is immediate
        await syncSubscriptionFromDB();
        setStatus("success");
        setTimeout(() => navigate("/dashboard"), 2500);
      } catch (err) {
        setStatus("error");
        setMessage(
          err instanceof EdgeFunctionError
            ? err.message
            : (err as Error).message ?? "Something went wrong",
        );
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
          <CheckCircle className="h-16 w-16 text-[#E1DCC9]/80" />
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
