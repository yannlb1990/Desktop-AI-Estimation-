import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "Metricore <noreply@risen-up.com>";

const ALLOWED_ORIGINS = [
  "https://www.metricore.com.au",
  "https://metricore.com.au",
  "http://localhost:8080",
];

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function he(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

type EmailType =
  | "trial_ending"
  | "trial_expired"
  | "payment_receipt"
  | "payment_failed"
  | "quote_sent"
  | "welcome"
  | "admin_new_trial"
  | "admin_new_payment";

interface EmailPayload {
  type: EmailType;
  to: string | string[];
  name?: string;
  data?: Record<string, any>;
}

function buildHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700&display=swap');
  body { margin:0; padding:0; background:#f5f0e8; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrap { max-width:580px; margin:36px auto; }
  .header { background:#0B0704; padding:24px 32px; border-radius:10px 10px 0 0; border-bottom:1px solid #2a1a0e; }
  .logo { font-family:'Poppins','Segoe UI',sans-serif; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:-0.3px; margin:0; }
  .logo span { color:#D4A045; }
  .card { background:#ffffff; padding:36px 32px; }
  .card p { margin:0 0 18px; font-size:15px; line-height:1.65; color:#374151; }
  .card p:last-child { margin-bottom:0; }
  .amount { font-family:'Poppins','Segoe UI',sans-serif; font-size:32px; font-weight:700; color:#D4A045; margin:0 0 20px; letter-spacing:-0.5px; }
  .badge { display:inline-block; background:#412D15; color:#E1DCC9; padding:4px 14px; border-radius:20px; font-size:13px; font-weight:600; }
  .cta { display:inline-block; margin:8px 0 0; background:#E1DCC9; color:#000000; padding:13px 28px; border-radius:7px; text-decoration:none; font-size:15px; font-weight:600; font-family:'Poppins','Segoe UI',sans-serif; }
  .divider { border:none; border-top:1px solid #f0e8dc; margin:24px 0; }
  .data-table { width:100%; border-collapse:collapse; font-size:14px; }
  .data-table td { padding:10px 0; vertical-align:top; }
  .data-table td:first-child { color:#8a7060; width:140px; }
  .data-table td:last-child { color:#1a110a; font-weight:500; }
  .data-table tr + tr td { border-top:1px solid #f5f0e8; }
  .footer { background:#f5f0e8; padding:20px 32px; border-radius:0 0 10px 10px; border-top:1px solid #e8ddd0; }
  .footer p { margin:0 0 6px; font-size:12px; color:#8a7060; line-height:1.5; }
  .footer p:last-child { margin:0; }
  .footer a { color:#D4A045; text-decoration:none; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:10px;">
        <img src="https://www.metricore.com.au/metricore-icon.png" width="36" height="36" alt="Metricore" style="display:block;border-radius:8px;">
      </td>
      <td style="vertical-align:middle;"><p class="logo">Metri<span>core</span></p></td>
    </tr></table>
  </div>
  <div class="card">${body}</div>
  <div class="footer">
    <p>Metricore. AI-powered estimation for Australian builders.</p>
    <p>Questions? Contact us at <a href="mailto:admin@metricore.com.au">admin@metricore.com.au</a></p>
  </div>
</div>
</body>
</html>`;
}

function getTemplate(payload: EmailPayload): { subject: string; html: string } {
  const name = he(payload.name || "there");
  const d = payload.data ?? {};

  switch (payload.type) {
    case "welcome":
      return {
        subject: "Your Metricore trial is live",
        html: buildHtml(`
          <p>Hi ${name},</p>
          <p>Your account is live. You have <strong>14 days of full access</strong> to the platform.</p>
          <p>Upload a PDF plan, run a takeoff, and get a complete cost estimate done on a real job before your trial ends. Your first quote can be ready in under 10 minutes.</p>
          <a href="https://www.metricore.com.au/dashboard" class="cta">Open dashboard</a>
        `),
      };

    case "trial_ending":
      return {
        subject: `Your Metricore trial ends in ${he(d.daysLeft) ?? 3} days`,
        html: buildHtml(`
          <p>Hi ${name},</p>
          <p>Your trial ends in <strong>${he(d.daysLeft) ?? 3} day${d.daysLeft !== 1 ? 's' : ''}</strong>. After that, your projects stay saved but you will need an active plan to access them.</p>
          <p>Selected plan: <span class="badge">${he(d.planName ?? 'Pro')}</span></p>
          <a href="https://www.metricore.com.au/pricing" class="cta">Subscribe</a>
        `),
      };

    case "trial_expired":
      return {
        subject: "Your Metricore trial has ended",
        html: buildHtml(`
          <p>Hi ${name},</p>
          <p>Your 14-day trial has ended. Your projects and estimates are still saved. Subscribe to pick up where you left off.</p>
          <a href="https://www.metricore.com.au/pricing" class="cta">Choose a plan</a>
        `),
      };

    case "payment_receipt":
      return {
        subject: `Subscription confirmed. ${he(d.planName ?? 'Metricore')} plan.`,
        html: buildHtml(`
          <p>Hi ${name},</p>
          <p>Your subscription is confirmed. Receipt below.</p>
          <p class="amount">${he(d.amount ?? '$0.00')}</p>
          <table class="data-table">
            <tr><td>Plan</td><td><span class="badge">${he(d.planName ?? 'Pro')}</span></td></tr>
            <tr><td>Billing</td><td>${he(d.billing ?? 'Monthly')}</td></tr>
            <tr><td>Next payment</td><td>${he(d.nextDate ?? 'N/A')}</td></tr>
            <tr><td>Invoice</td><td>${he(d.invoiceId ?? 'N/A')}</td></tr>
          </table>
          <hr class="divider">
          <a href="https://www.metricore.com.au/settings" class="cta">Manage subscription</a>
        `),
      };

    case "payment_failed":
      return {
        subject: "Payment failed. Action required.",
        html: buildHtml(`
          <p>Hi ${name},</p>
          <p>We could not process your last payment. You have <strong>3 days</strong> to update your details before access is paused.</p>
          <a href="https://www.metricore.com.au/settings" class="cta">Update payment method</a>
        `),
      };

    case "quote_sent": {
      const replyEmail = he(d.replyEmail ?? '');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const safeReplyEmail = emailRegex.test(d.replyEmail ?? '') ? replyEmail : '';
      return {
        subject: `Quote from ${he(d.companyName ?? 'your estimator')} for ${he(d.projectName ?? 'your project')}`,
        html: buildHtml(`
          <p>Hi ${he(d.clientName ?? (payload.name || 'there'))},</p>
          <p><strong>${he(d.companyName ?? 'Your estimator')}</strong> has sent you a quote for <strong>${he(d.projectName ?? 'your project')}</strong>.</p>
          ${d.totalAmount ? `<p class="amount">${he(d.totalAmount)}</p>` : ''}
          <hr class="divider">
          ${safeReplyEmail ? `<a href="mailto:${safeReplyEmail}" class="cta">Reply to estimator</a>` : ''}
        `),
      };
    }

    case "admin_new_trial":
      return {
        subject: `New trial: ${he(d.name ?? 'Unknown')} (${he(d.email ?? '')})`,
        html: buildHtml(`
          <table class="data-table">
            <tr><td>Name</td><td>${he(d.name ?? 'N/A')}</td></tr>
            <tr><td>Email</td><td><a href="mailto:${he(d.email ?? '')}" style="color:#D4A045;text-decoration:none;">${he(d.email ?? 'N/A')}</a></td></tr>
            <tr><td>Phone</td><td>${he(d.phone ?? 'N/A')}</td></tr>
            <tr><td>Plan</td><td><span class="badge">${he(d.planId ?? 'N/A')}</span></td></tr>
            <tr><td>Billing</td><td>${he(d.billing ?? 'N/A')}</td></tr>
            <tr><td>Project type</td><td>${he(d.projectType ?? 'N/A')}</td></tr>
          </table>
          <hr class="divider">
          <a href="https://supabase.com/dashboard/project/dwimfbkwaebehxdavryg/auth/users" class="cta">View in Supabase</a>
        `),
      };

    case "admin_new_payment":
      return {
        subject: `New payment: ${he(d.planName ?? 'Plan')} ${he(d.amount ?? '')} — ${he(d.name ?? 'Unknown')}`,
        html: buildHtml(`
          <p class="amount">${he(d.amount ?? '$0')}</p>
          <table class="data-table">
            <tr><td>Name</td><td>${he(d.name ?? 'N/A')}</td></tr>
            <tr><td>Email</td><td><a href="mailto:${he(d.email ?? '')}" style="color:#D4A045;text-decoration:none;">${he(d.email ?? 'N/A')}</a></td></tr>
            <tr><td>Plan</td><td><span class="badge">${he(d.planName ?? 'N/A')}</span></td></tr>
            <tr><td>Billing</td><td>${he(d.billing ?? 'N/A')}</td></tr>
            <tr><td>Next renewal</td><td>${he(d.nextDate ?? 'N/A')}</td></tr>
          </table>
          <hr class="divider">
          <a href="https://dashboard.stripe.com/customers" class="cta">View in Stripe</a>
        `),
      };

    default:
      return { subject: "Metricore", html: buildHtml(`<p>Hi ${name},</p><p>You have a notification from Metricore.</p>`) };
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  // ── Auth: accept service-role key (internal calls) or valid user JWT ────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Supabase verifies JWT signatures at the infrastructure level before the function runs,
  // so checking the role claim here is safe — no unsigned JWT can reach this point.
  function jwtRole(t: string): string {
    try { return JSON.parse(atob(t.split('.')[1])).role ?? ''; }
    catch { return ''; }
  }
  const isServiceRole = jwtRole(token) === 'service_role';
  let authenticatedUser: { email?: string | null } | null = null;

  if (!isServiceRole) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    authenticatedUser = user;
  }

  if (!isServiceRole && !authenticatedUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  // ────────────────────────────────────────────────────────────────────────────

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let payload: EmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Guard: non-service-role callers can only send to their own email address (single string).
  const toAddresses: string[] = Array.isArray(payload.to) ? payload.to : [payload.to];
  if (!isServiceRole && authenticatedUser) {
    if (toAddresses.length !== 1 || toAddresses[0] !== authenticatedUser.email) {
      return new Response(JSON.stringify({ error: "Forbidden: recipient must match authenticated user email" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.to || !payload.type || toAddresses.length === 0 || !toAddresses.every(e => emailRegex.test(e))) {
    return new Response(JSON.stringify({ error: "Missing or invalid required fields: to, type" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { subject, html } = getTemplate(payload);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: toAddresses, subject, html }),
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("Resend error:", result);
    return new Response(JSON.stringify({ error: result }), {
      status: res.status, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, id: result.id }), {
    status: 200, headers: { ...cors, "Content-Type": "application/json" },
  });
});
