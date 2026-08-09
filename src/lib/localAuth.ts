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
    // Don't check expires_at here — the Supabase client auto-refreshes the access
    // token using the refresh_token. Checking expires_at causes false sign-outs
    // in the brief window between access token expiry and the client refresh.
    // A truly invalid session will fail at the Supabase API level instead.
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

// All user-specific localStorage keys that existed before per-user scoping was added
const LEGACY_KEYS = [
  'local_projects',
  'local_clients',
  'estimate_profile',
  'default_rates',
  'notif_prefs',
  'user_materials_library',
  'estimate_subscription',
  'project_reminders',
] as const;

export function getUserStorageKey(baseKey: string): string {
  const user = getLocalUser();
  return user ? `${user.email}:${baseKey}` : `__anon__:${baseKey}`;
}

// Runs once per user. If the old unscoped data belongs to this user (email matches),
// migrates it to scoped keys and clears the shared unscoped keys so no other user
// can see it. If the email doesn't match, just wipes the unscoped keys without
// migrating — the current user gets a clean slate and the old data is removed.
export function migrateUnscopedData(userEmail: string): void {
  const migrationFlag = `${userEmail}:migrated_v1`;
  if (localStorage.getItem(migrationFlag)) return;

  // Mutex: prevent simultaneous migration across browser tabs (5-second TTL)
  const lockKey = `${userEmail}:migration-lock`;
  const existingLock = localStorage.getItem(lockKey);
  if (existingLock && Date.now() - parseInt(existingLock, 10) < 5000) return;
  localStorage.setItem(lockKey, String(Date.now()));

  try {
    // Determine who owned the old unscoped data
    const rawSub = localStorage.getItem('estimate_subscription');
    const oldOwnerEmail: string | null = rawSub
      ? (() => { try { return JSON.parse(rawSub)?.email ?? null; } catch { return null; } })()
      : null;

    const isOwner = oldOwnerEmail === userEmail;

    for (const key of LEGACY_KEYS) {
      const scopedKey = `${userEmail}:${key}`;
      const unscopedValue = localStorage.getItem(key);

      if (unscopedValue !== null) {
        if (isOwner && !localStorage.getItem(scopedKey)) {
          // Migrate this user's data to their scoped key
          localStorage.setItem(scopedKey, unscopedValue);
        }
        // Always clear the unscoped key — prevents any future user from seeing it
        localStorage.removeItem(key);
      }
    }

    localStorage.setItem(migrationFlag, 'done');
  } catch {
    // Never crash on migration failure — just proceed with clean slate
  } finally {
    localStorage.removeItem(lockKey);
  }
}

// Unscoped keys that are never prefixed with the user email — must be wiped on logout
const UNSCOPED_FIXED_KEYS = [
  'user_labour_rates',
  'user_custom_trades',
  'gantt_workDays',
  'gantt_exclHolidays',
  'gantt_holidayState',
] as const;

const UNSCOPED_KEY_PREFIXES = ['gantt_customHols_', 'planAnalysis_', 'frame_sections_'];

export async function localSignOut(): Promise<void> {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
  for (const key of UNSCOPED_FIXED_KEYS) {
    localStorage.removeItem(key);
  }
  // Remove pattern-based keys (project-scoped but not user-scoped)
  for (const key of Object.keys(localStorage)) {
    if (UNSCOPED_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  }
  await supabase.auth.signOut();
  window.dispatchEvent(new Event('metricore:auth'));
}

export function isSignedIn(): boolean {
  const session = readStoredSession();
  if (!session?.user) return false;
  return !!session.user.email_confirmed_at;
}
