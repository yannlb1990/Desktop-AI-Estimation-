import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, CheckCircle } from "lucide-react";
import { MetricoreLogoMark } from "@/components/MetricoreLogoMark";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sends the recovery token as a URL hash fragment.
  // The onAuthStateChange PASSWORD_RECOVERY event exchanges it for a session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      setDone(true);
      toast.success("Password updated successfully");
      setTimeout(() => navigate("/dashboard"), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <MetricoreLogoMark className="h-10 w-10" />
        </div>

        <Card className="p-8 space-y-6">
          {done ? (
            <div className="text-center space-y-3">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Password updated</h2>
              <p className="text-sm text-muted-foreground">Redirecting to your dashboard…</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
              <p className="text-xs text-muted-foreground">
                If this takes too long,{" "}
                <button
                  className="underline text-primary"
                  onClick={() => navigate("/auth")}
                >
                  request a new link
                </button>
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Set a new password</h2>
                <p className="text-sm text-muted-foreground">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label>New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Min. 8 characters"
                      className="pl-9"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Confirm new password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Repeat password"
                      className="pl-9"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Update Password
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
