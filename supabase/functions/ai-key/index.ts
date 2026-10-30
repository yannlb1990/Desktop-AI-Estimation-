import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { encryptKey } from "../_shared/aiKey.ts";

/**
 * Settings > AI: the customer's own Claude API key.
 *   status -> { saved, hint, lastOkAt }
 *   save   { key } -> checked with Anthropic first, then stored encrypted
 *   remove
 */
const ALLOWED = ["https://www.metricore.com.au", "https://metricore.com.au", "http://localhost:8080"];
const cors = (o: string) => ({
  "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const headers = { ...cors(origin), "content-type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await db.auth.getUser((req.headers.get("Authorization") ?? "").replace("Bearer ", ""));
    if (!user) return reply({ error: "Sign in again" }, 401);
    const body = await req.json();
    const action = String(body.action ?? "");

    if (action === "status") {
      const { data } = await db.from("ai_keys").select("key_hint, last_ok_at").eq("user_id", user.id).maybeSingle();
      return reply(data ? { saved: true, hint: data.key_hint, lastOkAt: data.last_ok_at } : { saved: false });
    }
    if (action === "remove") {
      await db.from("ai_keys").delete().eq("user_id", user.id);
      return reply({ ok: true });
    }
    if (action === "save") {
      const key = String(body.key ?? "").trim();
      if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(key)) return reply({ error: "That does not look like a Claude API key (it starts with sk-ant-)" }, 400);
      // a free call that only works with a valid key
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
      if (r.status === 401 || r.status === 403) return reply({ error: "Anthropic refused that key: check it was copied in full and is still active" }, 400);
      if (!r.ok) return reply({ error: "Could not check the key with Anthropic: try again" }, 502);
      const { error } = await db.from("ai_keys").upsert({
        user_id: user.id, provider: "anthropic", key_encrypted: await encryptKey(key),
        key_hint: `sk-ant-...${key.slice(-4)}`, created_at: new Date().toISOString(), last_ok_at: new Date().toISOString(),
      });
      if (error) throw error;
      return reply({ ok: true, hint: `sk-ant-...${key.slice(-4)}` });
    }
    return reply({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[ai-key]", e instanceof Error ? e.message : "error"); // never the key
    return reply({ error: "Something went wrong: try again" }, 500);
  }
});
