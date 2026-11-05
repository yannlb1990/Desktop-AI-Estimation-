import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { claudeKeyFor, claudeRefusal } from "../_shared/aiKey.ts";

/**
 * BOQ rows the import could not place: the trade each one belongs to and a clean scope of
 * work. Only the rows' text is sent (no file, no prices); everything else in the import is
 * done in the browser by code.
 */

const ALLOWED_ORIGINS = [
  "https://www.metricore.com.au",
  "https://metricore.com.au",
  "http://localhost:8080",
  "http://localhost:3002",
  "http://localhost:5173",
];

function getCors(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// the trade list used everywhere in Metricore (src/lib/trades.ts)
const TRADES = [
  "Preliminaries", "Demolition", "Site Works", "Concrete", "Termite Protection", "Structural Steel", "Carpentry",
  "Roofing", "Windows & Doors", "Brickwork", "Cladding", "Render", "Insulation", "Plasterboard", "Waterproofing",
  "Tiling", "Joinery", "Shower Screens & Mirrors", "Painting", "Floor Coverings", "Epoxy Flooring", "Plumbing",
  "Electrical", "HVAC", "Fire Services", "Appliances", "Balustrades & Metalwork", "Garage Doors", "External Works",
  "Fencing", "Landscaping", "Scaffolding", "Crane / Lifting", "Waste & Cleaning", "Certifications", "General", "Other",
];

const TOOL = {
  name: "boq_rows",
  description: "The trade and a clean scope of work for each BOQ row.",
  input_schema: {
    type: "object",
    properties: {
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            i: { type: "number", description: "The row's i, unchanged" },
            trade: { type: "string", enum: TRADES },
            scope: { type: "string", description: "The work as a builder writes it, keeping sizes and specs from the row; no prices or quantities" },
          },
          required: ["i", "trade", "scope"],
        },
      },
    },
    required: ["rows"],
  },
};

const PROMPT = `You are an Australian quantity surveyor sorting rows of a residential bill of quantities into trades.
For each row give the trade it belongs to (from the list only) and the scope of work, cleaned up: keep the row's own wording, sizes and specifications, fix obvious typos and shorthand, drop item numbers, quantities and prices. Use "General" only when the row truly fits no trade. The section heading, when given, is a strong hint.
Rows:`;

serve(async (req) => {
  const cors = getCors(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const OWNER_EMAIL = "yannlb1990@gmail.com";
    if (user.email !== OWNER_EMAIL) {
      const { data: sub } = await supabase.from("subscriptions").select("plan_id, status").eq("user_id", user.id).maybeSingle();
      const ok = sub && sub.status === "active" && (sub.plan_id === "pro" || sub.plan_id === "business");
      if (!ok) return new Response(JSON.stringify({ error: "Plan upgrade required" }), { status: 403, headers: { ...cors, "content-type": "application/json" } });
    }
    const { key: anthropicKey, own: ownKey } = await claudeKeyFor(supabase, user.id);

    const body = await req.json() as { rows?: { i: number; text: string; heading?: string }[] };
    const rows = (body.rows ?? []).slice(0, 300)
      .map(r => ({ i: Number(r.i), text: String(r.text ?? "").slice(0, 400), heading: String(r.heading ?? "").slice(0, 80) }))
      .filter(r => Number.isFinite(r.i) && r.text.trim());
    if (!rows.length) throw new Error("No rows to sort");
    const list = rows.map(r => `${r.i}. ${r.heading ? `[${r.heading}] ` : ""}${r.text}`).join("\n");

    const why = (status: number, b: string) => {
      const plain = claudeRefusal(status, b, ownKey);
      if (plain) return plain;
      if (user.email !== OWNER_EMAIL) return "the AI service is unavailable right now, contact support if it continues";
      try { return `${status}: ${JSON.parse(b)?.error?.message ?? ""}`.slice(0, 160); } catch { return String(status); }
    };
    const call = (model: string) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: `${PROMPT}\n${list}` }],
      }),
    });

    let res = await call("claude-haiku-4-5-20251001");
    if (res.status === 404 || res.status === 400) {
      const first = await res.text();
      if (/model/i.test(first)) res = await call("claude-sonnet-4-6");
      else throw new Error(`The rows could not be sorted (${why(res.status, first)})`);
    }
    if (!res.ok) {
      const b = await res.text();
      console.error("[classify-boq] model error", res.status, b);
      throw new Error(res.status === 429 || res.status === 529 ? "The AI is busy right now: try again in a minute" : `The rows could not be sorted (${why(res.status, b)})`);
    }
    const out = await res.json();
    const tool = out.content?.find((b: { type: string; name?: string }) => b.type === "tool_use" && b.name === TOOL.name);
    if (!tool) throw new Error("No answer came back: try again");
    const valid = new Set(rows.map(r => r.i));
    const result = (tool.input.rows ?? []).filter((r: { i: number; trade: string }) => valid.has(r.i) && TRADES.includes(r.trade));
    return new Response(JSON.stringify({ rows: result }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[classify-boq]", raw);
    return new Response(JSON.stringify({ error: /abort|timeout/i.test(raw) ? "Sorting the rows took too long: try again" : raw }), {
      status: raw === "Unauthorized" ? 401 : 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
