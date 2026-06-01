/**
 * Signed URL helper for the plan-pdfs bucket.
 *
 * Handles three input shapes:
 *   1. blob: URL          → returned as-is (local, no auth needed)
 *   2. Storage path       → signed directly  (e.g. "uuid/uuid.pdf")
 *   3. Legacy public URL  → path extracted, then signed
 *      (https://...supabase.co/storage/v1/object/public/plan-pdfs/<path>)
 *
 * Results are session-cached so components that re-render don't hammer the API.
 * Cached entries are refreshed if they'll expire within 5 minutes.
 */
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'plan-pdfs';
const SIGNED_TTL_SECONDS = 3600; // 1 hour
const REFRESH_BEFORE_SECONDS = 300; // refresh if < 5 min left

interface CacheEntry { url: string; expiresAt: number }
const cache = new Map<string, CacheEntry>();

const PUBLIC_URL_PREFIX_RE = /\/storage\/v1\/object\/public\/plan-pdfs\//;

/** Extract the storage path from any supported input format. */
function extractPath(input: string): string | null {
  if (!input || input.startsWith('blob:')) return null;
  if (PUBLIC_URL_PREFIX_RE.test(input)) {
    const idx = input.search(PUBLIC_URL_PREFIX_RE);
    const after = input.slice(idx).replace('/storage/v1/object/public/plan-pdfs/', '');
    return after.split('?')[0]; // strip any query params
  }
  // Plain path (no scheme)
  if (!input.startsWith('http://') && !input.startsWith('https://')) return input;
  return null;
}

/**
 * Given a plan URL or storage path, return a short-lived signed URL.
 * Returns the original input unchanged if it's a blob URL or unrecognised format.
 */
export async function getSignedPlanUrl(input: string | null | undefined): Promise<string | null> {
  if (!input) return null;
  if (input.startsWith('blob:')) return input;

  const path = extractPath(input);
  if (!path) return input; // unrecognised — pass through

  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt - now > REFRESH_BEFORE_SECONDS * 1000) {
    return cached.url;
  }

  try {
    const { data, error } = await (supabase as any).storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.warn('[signedPlanUrl] Failed to sign:', path, error?.message);
      return null;
    }

    cache.set(path, {
      url: data.signedUrl,
      expiresAt: now + SIGNED_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  } catch (err) {
    console.warn('[signedPlanUrl] Unexpected error:', err);
    return null;
  }
}

/** Invalidate a cached entry (call after re-upload). */
export function invalidateSignedUrl(pathOrUrl: string) {
  const path = extractPath(pathOrUrl) ?? pathOrUrl;
  cache.delete(path);
}
