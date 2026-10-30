import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { claudeKeyFor, claudeRefusal } from "../_shared/aiKey.ts";

/**
 * Site visit review: reads a builder's site visit (rooms, sizes, ticks, notes, measurements
 * and photos) and suggests scope lines that look missing plus things to check before
 * quoting. The visit is loaded here for the signed-in user (never trusted from the
 * browser); photos are passed to the model as short-lived signed links.
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

const TOOL = {
  name: "site_review",
  description: "Scope lines that look missing from the site visit, and things to check before quoting.",
  input_schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        description: "Work the visit implies but did not tick or measure. Do not repeat items already ticked or measured.",
        items: {
          type: "object",
          properties: {
            room: { type: "string", description: "Room name exactly as given, or 'Whole job'" },
            scope: { type: "string", description: "Short scope of work, e.g. 'Remove and dispose existing vanity'" },
            trade: { type: "string", description: "Carpenter, Demolition, Plumber, Electrician, Tiler, Waterproofer, Plasterer, Painter, Concreter, Roofer, Landscaper, Flooring, Cabinetmaker or General" },
            unit: { type: "string", enum: ["m²", "lm", "m³", "ea", "item"] },
            quantity: { type: "number", description: "From the room sizes or what is visible; 0 if it cannot be judged" },
            reason: { type: "string", description: "One sentence: what in the notes or photos shows this is needed" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["room", "scope", "trade", "unit", "quantity", "reason", "confidence"],
        },
      },
      checks: {
        type: "array",
        description: "Risks and compliance points to confirm before quoting (Australian context).",
        items: {
          type: "object",
          properties: {
            room: { type: "string" },
            text: { type: "string", description: "Plain, specific, one sentence" },
            standard: { type: "string", description: "Relevant standard or rule if any, e.g. 'AS 3740', 'NCC', 'AS/NZS 3000'" },
          },
          required: ["room", "text"],
        },
      },
    },
    required: ["suggestions", "checks"],
  },
};

const PROMPT = `You are a senior Australian residential renovation estimator reviewing a builder's site visit before they price it.
You get each room's sizes, the scope items the builder ticked, extra measurements, the builder's notes (often dictated, so loosely worded) and photos.

Suggest only work that is genuinely implied and missing: things the notes or photos show, or that the ticked work requires (for example waterproofing needs a screed or falls check, a new vanity needs removal of the old one, new tiles over old need demolition and disposal, wet-area walls need FC sheet, rubbish removal or skip bins for strip-outs, temporary protection, plumbing rough-in and fit-off).
Use the room sizes for quantities where they apply (floor area, wall area = perimeter x height, perimeter for skirting/cornice). If a quantity cannot be judged, use 0.
Do not repeat anything already ticked or measured. Do not invent rooms. Keep scope names short, the way a builder writes them.

Then list things to check before quoting, specific to this job: for example asbestos in houses built before 1990 (likely in fibro sheeting, vinyl floor tiles, eaves), waterproofing to AS 3740, smoke alarm requirements, structural changes needing an engineer, electrical work to AS/NZS 3000 by a licensed electrician, termite or rot signs, access and parking, power and water on site. Only list what is relevant to what you see and read.
Be concrete and brief. Australian spelling and terms.`;

serve(async (req) => {
  const cors = getCors(req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    // Same access rule as the plan analyser
    const OWNER_EMAIL = "yannlb1990@gmail.com";
    if (user.email !== OWNER_EMAIL) {
      const { data: sub } = await supabase.from("subscriptions").select("plan_id, status").eq("user_id", user.id).maybeSingle();
      // same rule as the plan analyser: an active Pro or Business plan
      const ok = sub && sub.status === "active" && (sub.plan_id === "pro" || sub.plan_id === "business");
      if (!ok) {
        return new Response(JSON.stringify({ error: "Plan upgrade required" }), { status: 403, headers: { ...cors, "content-type": "application/json" } });
      }
    }

    // the customer's own Claude key when they saved one (billed to them), else Metricore's
    const { key: anthropicKey, own: ownKey } = await claudeKeyFor(supabase, user.id);

    const { visitId, summary } = await req.json() as { visitId?: string; summary?: string };
    if (!visitId) throw new Error("visitId is required");

    const { data: row, error: rowErr } = await supabase.from("site_visits")
      .select("data").eq("id", visitId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (rowErr || !row?.data?.rooms) throw new Error("This visit has not reached the office yet: open it on the phone with signal, then try again");
    const visit = row.data as { jobName?: string; address?: string; notes?: string; rooms: { name: string; photos: { path?: string }[] }[] };

    // Only this user's photos of this visit, in a format and size the model accepts
    const folder = `${user.id}/${visitId}`;
    const { data: files } = await supabase.storage.from("site-photos").list(folder, { limit: 1000 });
    const okFile = new Map<string, boolean>();
    for (const f of files ?? []) {
      const type = String((f.metadata as any)?.mimetype ?? "");
      const size = Number((f.metadata as any)?.size ?? 0);
      okFile.set(`${folder}/${f.name}`, /^image\/(jpeg|png|webp|gif)$/.test(type) && size > 0 && size <= 5_000_000);
    }
    // Up to 3 photos per room, 15 in all, as signed links the model can open
    const imageBlocks: object[] = [];
    for (const room of visit.rooms) {
      const paths = (room.photos ?? []).map(p => p.path)
        .filter((p): p is string => !!p && p.startsWith(`${folder}/`) && okFile.get(p) === true).slice(0, 3);
      for (const path of paths) {
        if (imageBlocks.length >= 30) break; // 15 photos (a label and an image each)
        const { data: signed } = await supabase.storage.from("site-photos").createSignedUrl(path, 900);
        if (!signed?.signedUrl) continue;
        imageBlocks.push({ type: "text", text: `Photo from: ${room.name}` });
        imageBlocks.push({ type: "image", source: { type: "url", url: signed.signedUrl } });
      }
    }

    // The client sends a readable summary (labels, sizes, quantities); the data above is the source of truth for photos
    const text = `${PROMPT}\n\nSITE VISIT\n${String(summary ?? "").slice(0, 12000)}`;

    // the model service's own short reason, e.g. "credit balance too low" (no secrets in it)
    const why = (status: number, body: string) => {
      const plain = claudeRefusal(status, body, ownKey);
      if (plain) return plain;
      // customers get a plain message; only the owner sees the service's own reason (billing etc.)
      if (user.email !== OWNER_EMAIL) return "the AI service is unavailable right now, contact support if it continues";
      try { return `${status}: ${JSON.parse(body)?.error?.message ?? ''}`.slice(0, 160); } catch { return String(status); }
    };
    const call = (model: string) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: [...imageBlocks, { type: "text", text }] }],
      }),
    });

    let res = await call("claude-sonnet-5");
    if (res.status === 404 || res.status === 400) {
      // model name not available on this key: the plan analyser's model works
      const firstErr = await res.text();
      if (/model/i.test(firstErr)) res = await call("claude-sonnet-4-6");
      else { console.error("[analyse-site] model error", res.status, firstErr); throw new Error(`The review could not run (${why(res.status, firstErr)})`); }
    }
    if (!res.ok) {
      const body = await res.text();
      console.error("[analyse-site] model error", res.status, body);
      throw new Error(res.status === 429 || res.status === 529 ? "The AI is busy right now: try again in a minute" : `The review could not run (${why(res.status, body)})`);
    }
    const out = await res.json();
    if (out.stop_reason === "max_tokens") throw new Error("This visit is too large to review in one go: try again, or review fewer rooms");
    const tool = out.content?.find((b: { type: string; name?: string }) => b.type === "tool_use" && b.name === TOOL.name);
    if (!tool) throw new Error("No review came back: try again");

    return new Response(JSON.stringify({ result: tool.input, photos: imageBlocks.length / 2 }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const timeout = /abort|timed out|timeout/i.test(raw);
    console.error("[analyse-site]", raw);
    return new Response(JSON.stringify({ error: timeout ? "The review took too long: try again" : raw }), {
      status: timeout ? 504 : raw === "Unauthorized" ? 401 : /not reached the office/.test(raw) ? 404 : 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
