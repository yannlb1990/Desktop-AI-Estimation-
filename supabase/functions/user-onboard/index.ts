import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, email, phone, project_type, plan_id, billing_period } = await req.json();

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !project_type || !plan_id) {
      return json({ error: "All fields are required" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email.trim(), {
      data: {
        displayName: name.trim(),
        phone: phone.trim(),
        project_type,
        plan_id,
        billing_period: billing_period ?? "monthly",
      },
      redirectTo: "https://www.metricore.com.au/setup-password",
    });

    if (error) {
      // Supabase returns 422 if the user already exists
      if (error.status === 422 || error.message?.toLowerCase().includes("already")) {
        return json({ error: "already_exists" }, 409);
      }
      return json({ error: error.message }, 400);
    }

    // Store extended profile data in the profiles table
    await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      email: data.user.email,
      name: name.trim(),
      phone: phone.trim(),
      project_type,
      plan_id,
      billing_period: billing_period ?? "monthly",
    });

    return json({ success: true });
  } catch (err) {
    console.error("user-onboard error:", err);
    return json({ error: "Something went wrong — please try again" }, 500);
  }
});
