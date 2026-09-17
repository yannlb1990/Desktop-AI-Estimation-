import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_DOMAIN = "noreply@metricore.com.au";

const ALLOWED_ORIGINS = [
  "https://www.metricore.com.au",
  "https://metricore.com.au",
  "http://localhost:3002",
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

interface BrandInfo {
  companyName?: string;
  logo?: string;    // base64 data URL — used in PDF client-side only, not in email
  primary?: string; // hex color
  accent?: string;  // hex color
  abn?: string;
  phone?: string;
}

interface Attachment {
  filename: string;
  content: string; // base64
}

interface QuotePayload {
  supplierEmail: string;
  supplierName: string;
  projectName: string;
  siteAddress: string;
  trades: string[];
  contractorName: string;
  contractorEmail: string;
  message?: string;
  brand?: BrandInfo;
  attachments?: Attachment[];
}

function buildFromAddress(brand?: BrandInfo): string {
  const company = brand?.companyName?.trim();
  if (company) {
    return `${company} via Metricore <${FROM_DOMAIN}>`;
  }
  return `Metricore <${FROM_DOMAIN}>`;
}

function buildQuoteHtml(p: QuotePayload): string {
  const primary = p.brand?.primary || "#1a1a2e";
  const accent = p.brand?.accent || "#d4a045";
  const companyName = p.brand?.companyName || p.contractorName || "Your Estimator";

  const tradeList = p.trades && p.trades.length > 0
    ? p.trades.map(t => `<li style="margin:4px 0;">${he(t)}</li>`).join("")
    : "<li>General works</li>";

  const messageBlock = p.message
    ? `<p style="margin:20px 0 0;border-left:3px solid ${he(accent)};padding-left:12px;color:#6b5240;">${he(p.message)}</p>`
    : "";

  // Contact line: ABN + phone under company name
  const contactParts: string[] = [];
  if (p.brand?.abn) contactParts.push(`ABN ${he(p.brand.abn)}`);
  if (p.brand?.phone) contactParts.push(he(p.brand.phone));
  const contactLine = contactParts.length > 0
    ? `<p style="margin:2px 0 0;color:rgba(255,255,255,0.65);font-size:12px;">${contactParts.join(" &nbsp;·&nbsp; ")}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f2f0;margin:0;padding:0;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.1);}
  .header{background:${primary};padding:24px 32px 20px;}
  .accent-bar{height:3px;background:${accent};}
  .body{padding:32px;color:#374151;font-size:15px;line-height:1.7;}
  ul{margin:8px 0 16px;padding-left:20px;}
  .note{background:#fdf9f3;border:1px solid #e8d8b8;border-radius:6px;padding:14px 16px;font-size:13px;color:#7a5c30;margin:20px 0;}
  .footer{background:#f8f7f5;padding:18px 32px;font-size:12px;color:#9ca3af;border-top:1px solid #e8e5e0;}
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <p style="margin:0;color:#fff;font-size:19px;font-weight:700;letter-spacing:-0.3px;">${he(companyName)}</p>
      ${contactLine}
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.5);font-size:13px;">Quote Request</p>
    </div>
    <div class="accent-bar"></div>
    <div class="body">
      <p>Hi ${he(p.supplierName)},</p>
      <p><strong>${he(p.contractorName || companyName)}</strong> is requesting a quote for the following work:</p>

      <p style="margin:0 0 4px;"><strong>Project:</strong> ${he(p.projectName || "—")}</p>
      <p style="margin:0 0 16px;"><strong>Site:</strong> ${he(p.siteAddress || "—")}</p>

      <p style="margin:0 0 4px;font-weight:600;">Scope of work:</p>
      <ul>${tradeList}</ul>

      <div class="note">
        <strong>Attached:</strong> A PDF and Excel quote form with full item details and quantities.
        Please fill in your pricing (excl. GST) and reply to this email with the completed document.
      </div>

      ${messageBlock}

      <p>Reply to <a href="mailto:${he(p.contractorEmail)}" style="color:${he(accent)};">${he(p.contractorEmail)}</a> with your pricing.</p>
      <p style="margin-top:24px;">Thanks,<br><strong>${he(p.contractorName || companyName)}</strong></p>
    </div>
    <div class="footer">
      Sent via <a href="https://www.metricore.com.au" style="color:#9ca3af;">Metricore</a> on behalf of ${he(companyName)}.
    </div>
  </div>
</body>
</html>`;
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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Verify the caller's JWT via Supabase auth.
  // Service-role key and user session tokens both work.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await supabase.auth.getUser();

  // Service-role tokens don't resolve to a user — allow them through
  // by checking the role claim embedded in the JWT.
  const token = authHeader.replace(/^Bearer\s+/i, "");
  let isServiceRole = false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    isServiceRole = payload?.role === "service_role";
  } catch { /* malformed JWT — leave isServiceRole false */ }

  if (!user && !isServiceRole) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let payload: QuotePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.supplierEmail || !emailRegex.test(payload.supplierEmail)) {
    return new Response(JSON.stringify({ error: "Invalid supplier email" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const subject = `Quote Request — ${payload.projectName || "Project"}${payload.siteAddress ? ` — ${payload.siteAddress}` : ""}`;
  const html = buildQuoteHtml(payload);
  const from = buildFromAddress(payload.brand);

  const resendBody: Record<string, unknown> = {
    from,
    to: [payload.supplierEmail],
    reply_to: payload.contractorEmail || undefined,
    subject,
    html,
  };

  // Only attach the quote files (PDF + Excel). No logo attachment — keeps the
  // payload clean and avoids Resend rejecting unknown attachment fields.
  if (payload.attachments && payload.attachments.length > 0) {
    resendBody.attachments = payload.attachments.map(a => ({
      filename: a.filename,
      content: a.content,
    }));
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendBody),
  });

  const result = await res.json();
  if (!res.ok) {
    console.error("Resend error:", result);
    return new Response(JSON.stringify({ error: result }), {
      status: res.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, id: result.id }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
