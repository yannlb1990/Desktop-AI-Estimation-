import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';
import type { Database } from '@/integrations/supabase/types';

const LS_KEY = 'local_clients';

export type Client = Database['public']['Tables']['clients']['Row'];
type ClientInsert = Database['public']['Tables']['clients']['Insert'];

export function lsLoadClients(): Client[] {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey(LS_KEY)) || '[]');
  } catch {
    return [];
  }
}

export function lsSaveClients(clients: Client[]): void {
  localStorage.setItem(getUserStorageKey(LS_KEY), JSON.stringify(clients));
}

async function getAuthUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function syncClientToSupabase(client: Client): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;
  try {
    const row: ClientInsert = { ...client, user_id: userId, updated_at: new Date().toISOString() };
    await supabase.from('clients').upsert(row, { onConflict: 'id' });
  } catch { /* silent — local data is source of truth */ }
}

export async function deleteClientFromSupabase(clientId: string): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;
  try {
    await supabase.from('clients').delete().eq('id', clientId).eq('user_id', userId);
  } catch { /* silent */ }
}

export async function loadClientsFromSupabase(): Promise<Client[]> {
  const userId = await getAuthUserId();
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export async function loadClientsMerged(): Promise<Client[]> {
  const [dbClients, lsClients] = await Promise.all([
    loadClientsFromSupabase(),
    Promise.resolve(lsLoadClients()),
  ]);

  if (dbClients.length === 0) return lsClients;

  const dbIds = new Set(dbClients.map(c => c.id));
  const lsOnly = lsClients.filter(c => !dbIds.has(c.id));
  lsOnly.forEach(c => syncClientToSupabase(c));

  return [...dbClients, ...lsOnly];
}

export async function migrateLocalClientsToSupabase(userEmail: string): Promise<void> {
  const flag = `${userEmail}:db_clients_migrated_v1`;
  if (localStorage.getItem(flag)) return;

  const clients = lsLoadClients();
  if (clients.length > 0) {
    await Promise.all(clients.map(c => syncClientToSupabase(c)));
  }
  localStorage.setItem(flag, 'done');
}
