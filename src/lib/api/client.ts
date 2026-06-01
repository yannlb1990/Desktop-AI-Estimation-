/**
 * Typed edge function client.
 * Single source of truth for all frontend → Supabase edge function calls.
 * Never call fetch() or supabase.functions.invoke() directly — use this.
 */
import { supabase } from '@/integrations/supabase/client';

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

// ── Standard error shape returned by every edge function ─────────────────────
export interface EdgeError {
  error: string;
  status: number;
}

export class EdgeFunctionError extends Error {
  constructor(
    public readonly message: string,
    public readonly status: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = 'EdgeFunctionError';
  }
}

// ── Auth modes ────────────────────────────────────────���───────────────────────
type AuthMode = 'bearer' | 'none';

interface CallOptions {
  auth?: AuthMode;
  signal?: AbortSignal;
}

/**
 * Typed fetch wrapper for Supabase edge functions.
 * - Always sends JSON body
 * - Always expects JSON response
 * - Throws EdgeFunctionError on non-2xx or { error } body
 */
export async function callEdge<Req, Res>(
  functionName: string,
  body: Req,
  { auth = 'bearer', signal }: CallOptions = {},
): Promise<Res> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth === 'bearer') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new EdgeFunctionError('Not authenticated — please sign in', 401);
    }
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${FUNCTIONS_BASE}/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new EdgeFunctionError(`Edge function returned non-JSON (${res.status})`, res.status);
  }

  if (!res.ok) {
    const msg = (json as any)?.error ?? `Request failed (${res.status})`;
    throw new EdgeFunctionError(msg, res.status, json);
  }

  return json as Res;
}
