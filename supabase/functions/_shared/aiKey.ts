// A customer's own Claude API key: AES-GCM encrypted at rest with AI_KEY_SECRET (edge
// secrets only). Never returned to the browser, never logged.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function cryptoKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("AI_KEY_SECRET");
  if (!secret) throw new Error("AI_KEY_SECRET is not configured");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptKey(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), enc.encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function decryptKey(stored: string): Promise<string> {
  const [iv, ct] = stored.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await cryptoKey(), unb64(ct));
  return dec.decode(plain);
}

/** The key to call Claude with: the customer's own when they saved one, else Metricore's. */
export async function claudeKeyFor(db: SupabaseClient, userId: string): Promise<{ key: string; own: boolean }> {
  const { data } = await db.from("ai_keys").select("key_encrypted").eq("user_id", userId).eq("provider", "anthropic").maybeSingle();
  if (data?.key_encrypted) {
    try { return { key: await decryptKey(data.key_encrypted), own: true }; } catch { /* unreadable: fall back */ }
  }
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  return { key, own: false };
}

/** Plain words for a refusal from Anthropic, depending on whose key was used. */
export function claudeRefusal(status: number, body: string, own: boolean): string | null {
  let msg = "";
  try { msg = JSON.parse(body)?.error?.message ?? ""; } catch { /* not json */ }
  if (own) {
    if (status === 401 || status === 403) return "Your Claude API key was refused by Anthropic: check it in Settings > AI";
    if (/credit balance/i.test(msg)) return "Your Anthropic account is out of credit: top it up at console.anthropic.com";
    if (status === 429) return "Your Anthropic account hit its rate limit: try again in a minute";
  }
  return null;
}
