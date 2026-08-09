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

function json(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
const PHONE_REGEX = /^[\d\s\+\-\(\)]{7,20}$/;
const ALLOWED_PROJECT_TYPES = ["residential", "commercial", "industrial", "renovation", "other"];
const ALLOWED_PLAN_IDS = ["starter", "pro", "business"];
const ALLOWED_BILLING = ["monthly", "annual"];

serve(async (req) => {
  const cors = getCors(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json();
    const name = (body.name ?? '').trim().slice(0, 100);
    const email = (body.email ?? '').trim().toLowerCase().slice(0, 254);
    const phone = (body.phone ?? '').trim().slice(0, 20);
    const project_type = (body.project_type ?? '').trim();
    const plan_id = (body.plan_id ?? '').trim();
    const billing_period = (body.billing_period ?? 'monthly').trim();
    const password = (body.password ?? '').trim();

    if (!name) return json({ error: "Name is required" }, 400, cors);
    if (!email || !EMAIL_REGEX.test(email)) return json({ error: "Valid email is required" }, 400, cors);
    if (!phone || !PHONE_REGEX.test(phone)) return json({ error: "Valid phone number is required" }, 400, cors);
    if (!ALLOWED_PROJECT_TYPES.includes(project_type)) return json({ error: "Invalid project type" }, 400, cors);
    if (!ALLOWED_PLAN_IDS.includes(plan_id)) return json({ error: "Invalid plan" }, 400, cors);
    if (!ALLOWED_BILLING.includes(billing_period)) return json({ error: "Invalid billing period" }, 400, cors);
    if (password && password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400, cors);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const userMeta = { displayName: name, phone, project_type, plan_id, billing_period };

    let userId: string;

    if (password) {
      // Self-serve: create user with password, Supabase sends confirmation email
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: userMeta,
      });

      if (error) {
        if (error.status === 422 || error.message?.toLowerCase().includes("already")) {
          return json({ error: "already_exists" }, 409, cors);
        }
        return json({ error: error.message }, 400, cors);
      }
      userId = data.user.id;
    } else {
      // Invite flow: send setup-password email
      const appUrl = Deno.env.get("APP_URL") ?? "https://www.metricore.com.au";
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: userMeta,
        redirectTo: `${appUrl}/setup-password`,
      });

      if (error) {
        if (error.status === 422 || error.message?.toLowerCase().includes("already")) {
          return json({ error: "already_exists" }, 409, cors);
        }
        return json({ error: error.message }, 400, cors);
      }
      userId = data.user.id;
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      name,
      phone,
      project_type,
      plan_id,
      billing_period,
    });

    // Notify admin of new trial signup
    const primaryAdmin = Deno.env.get("ADMIN_NOTIFICATION_EMAIL") ?? "yannlb1990@gmail.com";
    const adminRecipients = [primaryAdmin, "admin@metricore.com.au"].filter(Boolean);
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        type: "admin_new_trial",
        to: adminRecipients,
        data: { name, email, phone, planId: plan_id, billing: billing_period, projectType: project_type },
      }),
    }).catch((err) => console.error("Admin trial notification failed:", err));

    return json({ success: true }, 200, cors);
  } catch (err) {
    console.error("user-onboard error:", err);
    return json({ error: "Something went wrong — please try again" }, 500, cors);
  }
});
