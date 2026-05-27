import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "Metricore <noreply@metricore.com.au>";

type EmailType =
  | "trial_ending"
  | "trial_expired"
  | "payment_receipt"
  | "payment_failed"
  | "quote_sent"
  | "welcome";

interface EmailPayload {
  type: EmailType;
  to: string;
  name?: string;
  data?: Record<string, any>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Templates ─────────────────────────────────────────────────────────────────

function buildHtml(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; margin: 0; padding: 0; }
  .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .header { background: #1a1a2e; padding: 28px 32px; }
  .header h1 { color: #fff; font-size: 20px; margin: 0; font-weight: 600; }
  .header span { color: #7c6dfa; }
  .body { padding: 32px; color: #374151; font-size: 15px; line-height: 1.6; }
  .body p { margin: 0 0 16px; }
  .cta { display: inline-block; background: #7c6dfa; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 8px 0; }
  .footer { background: #f8f9fa; padding: 20px 32px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  .amount { font-size: 28px; font-weight: 700; color: #1a1a2e; }
  .plan-badge { display: inline-block; background: #ede9fe; color: #7c3aed; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
</style></head>
<body>
  <div class="container">
    <div class="header"><h1>Metri<span>core</span></h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>Metricore — AI-powered estimation for Australian builders</p>
      <p>If you have questions, reply to this email or contact support@metricore.com.au</p>
    </div>
  </div>
</body>
</html>`;
}

function getTemplate(payload: EmailPayload): { subject: string; html: string } {
  const name = payload.name || "there";
  const d = payload.data ?? {};

  switch (payload.type) {
    case "welcome":
      return {
        subject: "Welcome to Metricore — your 14-day trial has started",
        html: buildHtml("Welcome", `
          <p>Hi ${name},</p>
          <p>Your Metricore account is ready. You have <strong>14 days of full Pro access</strong> to explore everything the platform has to offer.</p>
          <p>Here's what you can do right now:</p>
          <ul>
            <li>Upload a PDF plan and run AI takeoff in minutes</li>
            <li>Generate a professional quote with your branding</li>
            <li>Export a full tender document with NCC compliance</li>
          </ul>
          <a href="https://www.metricore.com.au/dashboard" class="cta">Open your dashboard →</a>
          <p>If you have any questions during your trial, just reply to this email.</p>
          <p>– The Metricore Team</p>
        `),
      };

    case "trial_ending":
      return {
        subject: `Your Metricore trial ends in ${d.daysLeft ?? 3} days`,
        html: buildHtml("Trial ending soon", `
          <p>Hi ${name},</p>
          <p>Your free trial ends in <strong>${d.daysLeft ?? 3} day${d.daysLeft !== 1 ? 's' : ''}</strong>. After that, you'll need an active subscription to keep accessing your projects and estimates.</p>
          <p>Your selected plan: <span class="plan-badge">${d.planName ?? 'Pro'}</span></p>
          <p>Subscribing takes less than 2 minutes — no data is lost when you upgrade.</p>
          <a href="https://www.metricore.com.au/pricing" class="cta">Subscribe now →</a>
          <p>– The Metricore Team</p>
        `),
      };

    case "trial_expired":
      return {
        subject: "Your Metricore trial has ended",
        html: buildHtml("Trial expired", `
          <p>Hi ${name},</p>
          <p>Your 14-day trial has ended. Your project data is safe — subscribe to continue where you left off.</p>
          <a href="https://www.metricore.com.au/pricing" class="cta">Choose a plan →</a>
          <p>Questions? Reply to this email and we'll help you out.</p>
          <p>– The Metricore Team</p>
        `),
      };

    case "payment_receipt":
      return {
        subject: `Receipt — ${d.planName ?? 'Metricore'} subscription`,
        html: buildHtml("Payment receipt", `
          <p>Hi ${name},</p>
          <p>Thanks for subscribing to Metricore. Here's your receipt.</p>
          <p class="amount">${d.amount ?? '$0.00'}</p>
          <p><span class="plan-badge">${d.planName ?? 'Pro'}</span></p>
          <p>
            Plan: ${d.planName ?? 'Pro'}<br/>
            Billing: ${d.billing ?? 'Monthly'}<br/>
            Next payment: ${d.nextDate ?? 'N/A'}<br/>
            Invoice ID: ${d.invoiceId ?? 'N/A'}
          </p>
          <a href="https://www.metricore.com.au/settings" class="cta">Manage subscription →</a>
          <p>– The Metricore Team</p>
        `),
      };

    case "payment_failed":
      return {
        subject: "Action required — payment failed for Metricore",
        html: buildHtml("Payment failed", `
          <p>Hi ${name},</p>
          <p>We couldn't process your payment. You have a <strong>3-day grace period</strong> to update your payment method before access is restricted.</p>
          <a href="https://www.metricore.com.au/settings" class="cta">Update payment method →</a>
          <p>If you need help, reply to this email.</p>
          <p>– The Metricore Team</p>
        `),
      };

    case "quote_sent":
      return {
        subject: `Quote from ${d.companyName ?? 'your estimator'} — ${d.projectName ?? 'your project'}`,
        html: buildHtml("Quote ready", `
          <p>Hi ${d.clientName ?? name},</p>
          <p>You've received a quote from <strong>${d.companyName ?? 'your estimator'}</strong> for <strong>${d.projectName ?? 'your project'}</strong>.</p>
          ${d.totalAmount ? `<p class="amount">${d.totalAmount}</p>` : ''}
          <p>Please review and get back to them directly.</p>
          ${d.replyEmail ? `<a href="mailto:${d.replyEmail}" class="cta">Reply to estimator →</a>` : ''}
        `),
      };

    default:
      return { subject: "Metricore notification", html: buildHtml("Notification", `<p>Hi ${name},</p><p>You have a notification from Metricore.</p>`) };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: EmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.to || !payload.type) {
    return new Response(JSON.stringify({ error: "Missing required fields: to, type" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { subject, html } = getTemplate(payload);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [payload.to], subject, html }),
  });

  const result = await res.json();

  if (!res.ok) {
    console.error("Resend error:", result);
    return new Response(JSON.stringify({ error: result }), {
      status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, id: result.id }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
