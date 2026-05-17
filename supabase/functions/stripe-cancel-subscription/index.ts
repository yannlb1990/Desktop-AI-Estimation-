import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get the user's subscription record
    const { data: sub, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_subscription_id, status, team_id")
      .eq("user_id", user.id)
      .single();

    if (subError || !sub) return json({ error: "No active subscription found" }, 404);
    if (sub.status === "canceled") return json({ error: "Subscription is already canceled" }, 400);
    if (!sub.stripe_subscription_id) return json({ error: "No Stripe subscription ID on record" }, 400);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-06-20",
    });

    // Cancel at period end — user keeps access until billing cycle ends
    const cancelled = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    const periodEnd = new Date(cancelled.current_period_end * 1000).toISOString();

    // If this is a team owner, flag all team members too (webhook will handle final cancellation)
    // For now just return the period end so the UI can display it
    console.log(`Subscription set to cancel at period end for user ${user.id}: ${periodEnd}`);

    return json({ success: true, cancel_at: periodEnd });
  } catch (err) {
    console.error("stripe-cancel-subscription error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
