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

    // Verify the inviting user has an active Business subscription
    const { data: ownerSub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_id, status, team_id")
      .eq("user_id", user.id)
      .single();

    if (!ownerSub || ownerSub.status !== "active" || ownerSub.plan_id !== "business") {
      return json({ error: "Team invites require an active Business subscription" }, 403);
    }

    const { email } = await req.json();
    if (!email || !email.includes("@")) return json({ error: "Invalid email address" }, 400);
    if (email.toLowerCase() === user.email!.toLowerCase()) {
      return json({ error: "You cannot invite yourself" }, 400);
    }

    // Get or create the team for this owner
    let teamId = ownerSub.team_id;
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
        if (teamError || !newTeam) return json({ error: "Failed to create team" }, 500);
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
      return json({ error: "All 5 seats are used. Remove a member to invite someone new." }, 400);
    }

    // Check not already a member
    const { data: existing } = await supabaseAdmin
      .from("team_members")
      .select("status")
      .eq("team_id", teamId)
      .eq("email", email.toLowerCase())
      .single();

    if (existing && existing.status === "active") {
      return json({ error: "This person is already a team member" }, 400);
    }
    if (existing && existing.status === "pending") {
      return json({ error: "An invite is already pending for this email" }, 400);
    }

    // Insert pending invite
    await supabaseAdmin.from("team_members").upsert({
      team_id: teamId,
      email: email.toLowerCase(),
      role: "member",
      status: "pending",
      invited_at: new Date().toISOString(),
    }, { onConflict: "team_id,email" });

    // Send invite email via Supabase Auth
    const origin = req.headers.get("origin") ?? "https://metricore.com.au";
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      { redirectTo: `${origin}/accept-invite` },
    );

    if (inviteError) {
      console.error("inviteUserByEmail error:", inviteError);
      // Still return success — invite is recorded, email may have already been sent
    }

    console.log(`Team invite sent to ${email} for team ${teamId}`);
    return json({ success: true, seats_used: usedSeats + 1, seats_total: 5 });
  } catch (err) {
    console.error("team-invite error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
