import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = `Metricore Quotes <${Deno.env.get("RESEND_FROM") ?? "quotes@metricore.com.au"}>`;

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

interface QuoteItem {
  trade: string;
  description: string;
  unit: string;
  quantity: number;
}

interface QuotePayload {
  supplierEmail: string;
  supplierName: string;
  projectName: string;
  siteAddress: string;
  clientName?: string;
  items: QuoteItem[];
  contractorName: string;
  contractorEmail: string;
  message?: string;
}

function buildQuoteHtml(p: QuotePayload): string {
  const itemRows = p.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${he(item.trade)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${he(item.description)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.quantity.toFixed(2)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${he(item.unit)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#9ca3af;">___________</td>
        </tr>`
    )
    .join("");

  const messageBlock = p.message
    ? `<p style="margin:0 0 16px;"><strong>Note from estimator:</strong><br>${he(p.message)}</p>`
    : "";

  const clientLine = p.clientName
    ? `<p style="margin:0 0 8px;"><strong>Client:</strong> ${he(p.clientName)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;margin:0;padding:0;}
  .container{max-width:640px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);}
  .header{background:#1a1a2e;padding:28px 32px;}
  .header h1{color:#fff;font-size:20px;margin:0;font-weight:600;}
  .header span{color:#7c6dfa;}
  .body{padding:32px;color:#374151;font-size:15px;line-height:1.6;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;}
  th{background:#f3f4f6;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;}
  th.right{text-align:right;}
  .footer{background:#f8f9fa;padding:20px 32px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;}
</style></head>
<body>
  <div class="container">
    <div class="header"><h1>Metri<span>core</span> — Quote Request</h1></div>
    <div class="body">
      <p>Hi ${he(p.supplierName)},</p>
      <p>You have received a quote request from <strong>${he(p.contractorName)}</strong>. Please review the items below and reply with your pricing.</p>

      <p style="margin:0 0 8px;"><strong>Project:</strong> ${he(p.projectName)}</p>
      <p style="margin:0 0 8px;"><strong>Site Address:</strong> ${he(p.siteAddress)}</p>
      ${clientLine}

      <table>
        <thead>
          <tr>
            <th>Trade</th>
            <th>Description</th>
            <th class="right">Qty</th>
            <th>Unit</th>
            <th>Your Price (excl GST)</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      ${messageBlock}

      <p>Please reply directly to this email with your pricing to <a href="mailto:${he(p.contractorEmail)}">${he(p.contractorEmail)}</a>.</p>
      <p>Thank you,<br><strong>${he(p.contractorName)}</strong></p>
    </div>
    <div class="footer">
      <p>This quote request was sent via Metricore — AI-powered estimation for Australian builders.</p>
      <p>Questions? Contact the estimator at ${he(p.contractorEmail)}</p>
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

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const isServiceRole = token === serviceRoleKey;
  let authenticated = false;

  if (isServiceRole) {
    authenticated = true;
  } else {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    authenticated = !!user;
  }

  if (!authenticated) {
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

  if (!payload.items || payload.items.length === 0) {
    return new Response(JSON.stringify({ error: "No items provided" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const subject = `Quote Request — ${payload.projectName || 'Project'} — ${payload.siteAddress || ''}`;
  const html = buildQuoteHtml(payload);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [payload.supplierEmail],
      reply_to: payload.contractorEmail || undefined,
      subject,
      html,
    }),
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
