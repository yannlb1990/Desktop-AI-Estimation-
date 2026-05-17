import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    // Find a pending invite for this user's email
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("team_members")
      .select("id, team_id, status")
      .eq("email", user.email!.toLowerCase())
      .eq("status", "pending")
      .single();

    if (inviteError || !invite) {
      return json({ error: "No pending invite found for this account" }, 404);
    }

    const now = new Date().toISOString();

    // Activate the team membership
    await supabaseAdmin
      .from("team_members")
      .update({ user_id: user.id, status: "active", joined_at: now })
      .eq("id", invite.id);

    // Write a Business subscription for this member (team-backed)
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan_id: "business",
        billing_period: "monthly",
        status: "active",
        team_id: invite.team_id,
        current_period_end: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

    console.log(`Team invite accepted by ${user.email} for team ${invite.team_id}`);
    return json({ success: true, team_id: invite.team_id });
  } catch (err) {
    console.error("team-accept-invite error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
