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

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

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

    // Verify the inviting user has a Business plan (paid active OR on trial)
    const { data: ownerSub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id, status, team_id")
      .eq("user_id", user.id)
      .single();

    const hasPaidBusiness = ownerSub?.status === "active" && ownerSub?.plan_id === "business";

    if (!hasPaidBusiness) {
      // Fall back to profiles.plan_id — covers Business trial users
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("plan_id")
        .eq("id", user.id)
        .single();

      if (!profile || profile.plan_id !== "business") {
        return json({ error: "Team invites require an active Business subscription" }, 403, cors);
      }
    }

    const { email } = await req.json();
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return json({ error: "Invalid email address" }, 400, cors);
    }
    if (normalizedEmail === user.email!.toLowerCase()) {
      return json({ error: "You cannot invite yourself" }, 400, cors);
    }

    // Get or create the team for this owner
    let teamId = ownerSub?.team_id ?? null;
    if (!teamId) {
      const { data: existingTeam } = await supabaseAdmin
        .from("teams")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

      if (existingTeam) {
        teamId = existingTeam.id;
      } else {
        const { data: newTeam, error: teamError } = await supabaseAdmin
          .from("teams")
          .insert({ owner_user_id: user.id, max_seats: 5 })
          .select("id")
          .single();
        if (teamError || !newTeam) return json({ error: "Failed to create team" }, 500, cors);
        teamId = newTeam.id;
        // Link team to owner's subscription
        await supabaseAdmin
          .from("subscriptions")
          .update({ team_id: teamId })
          .eq("user_id", user.id);
      }
    }

    // Count active + pending seats (excluding owner)
    const { data: members } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .in("status", ["active", "pending"]);

    const usedSeats = (members?.length ?? 0);
    if (usedSeats >= 4) { // 4 members + 1 owner = 5 total
      return json({ error: "All 5 seats are used. Remove a member to invite someone new." }, 400, cors);
    }

    // Check not already a member
    const { data: existing } = await supabaseAdmin
      .from("team_members")
      .select("status")
      .eq("team_id", teamId)
      .eq("email", normalizedEmail)
      .single();

    if (existing && existing.status === "active") {
      return json({ error: "This person is already a team member" }, 400, cors);
    }
    if (existing && existing.status === "pending") {
      return json({ error: "An invite is already pending for this email" }, 400, cors);
    }

    // Insert pending invite
    await supabaseAdmin.from("team_members").upsert({
      team_id: teamId,
      email: normalizedEmail,
      role: "member",
      status: "pending",
      invited_at: new Date().toISOString(),
    }, { onConflict: "team_id,email" });

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { redirectTo: "https://www.metricore.com.au/accept-invite" },
    );

    if (inviteError) {
      console.error("inviteUserByEmail error:", inviteError);
    }

    console.log(`Team invite sent to ${normalizedEmail} for team ${teamId}`);
    return json({ success: true, seats_used: usedSeats + 1, seats_total: 5 }, 200, cors);
  } catch (err) {
    console.error("team-invite error:", err);
    return json({ error: String(err) }, 500, cors);
  }
});

function json(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
