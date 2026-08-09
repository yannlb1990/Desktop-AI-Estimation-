import { supabase } from '@/integrations/supabase/client';

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** Load the preferences JSONB blob for the current user from Supabase. */
export async function loadUserPreferencesFromSupabase(): Promise<Record<string, any> | null> {
  const userId = await getUserId();
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_preferences' as any)
      .select('preferences')
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return (data as any).preferences ?? null;
  } catch { return null; }
}

/** Atomically merge a preferences patch for the current user using server-side JSONB || operator.
 *  No read-before-write — concurrent calls cannot overwrite each other's keys. */
export async function syncUserPreferencesToSupabase(patch: Record<string, any>): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  try {
    const { error } = await (supabase as any).rpc('merge_user_preferences', { patch });
    if (error) throw error;
  } catch (e) {
    console.error('[userPreferences] sync failed:', e instanceof Error ? e.message : e);
  }
}
