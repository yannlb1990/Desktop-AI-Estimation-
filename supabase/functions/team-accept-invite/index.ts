import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://www.metricore.com.au",
  "https://metricore.com.au",
  "http://localhost:8080",
];

function getCors(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

serve(async (req) => {
  const cors = getCors(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401, cors);

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
      return json({ error: "No pending invite found for this account" }, 404, cors);
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
    return json({ success: true, team_id: invite.team_id }, 200, cors);
  } catch (err) {
    console.error("team-accept-invite error:", err);
    return json({ error: String(err) }, 500, cors);
  }
});

function json(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
