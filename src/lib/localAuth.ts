// Supabase-backed auth — email verification required before access
import { supabase } from '@/integrations/supabase/client';

export interface LocalUser {
  email: string;
  displayName: string;
  state: string;
  createdAt: string;
}

// Read Supabase session from localStorage synchronously (Supabase persists it there)
function readStoredSession(): any | null {
  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.expires_at && Date.now() / 1000 > parsed.expires_at) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sessionUserToLocal(u: any): LocalUser {
  return {
    email: u.email ?? '',
    displayName: u.user_metadata?.displayName ?? u.email?.split('@')[0] ?? '',
    state: u.user_metadata?.state ?? '',
    createdAt: u.created_at ?? new Date().toISOString(),
  };
}

export async function localSignUp(
  email: string,
  password: string,
  displayName: string,
  state: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { displayName, state },
      emailRedirectTo: `${window.location.origin}/auth`,
    },
  });
  return { error: error?.message ?? null };
}

export async function localSignIn(
  email: string,
  password: string
): Promise<{ user: LocalUser | null; error: string | null; needsVerification?: boolean }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { user: null, error: null, needsVerification: true };
    }
    return { user: null, error: error.message };
  }
  const authUser = data.user;
  if (!authUser?.email_confirmed_at) {
    await supabase.auth.signOut();
    return { user: null, error: null, needsVerification: true };
  }
  return { user: sessionUserToLocal(authUser), error: null };
}

export function getLocalUser(): LocalUser | null {
  const session = readStoredSession();
  if (!session?.user) return null;
  const u = session.user;
  if (!u.email_confirmed_at) return null;
  return sessionUserToLocal(u);
}

export function localSignOut(): void {
  supabase.auth.signOut();
}

export function isSignedIn(): boolean {
  const session = readStoredSession();
  if (!session?.user) return false;
  return !!session.user.email_confirmed_at;
}
