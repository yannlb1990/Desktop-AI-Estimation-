import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';

export interface CostEntry {
  id: string;
  date: string;
  trade: string;
  supplier: string;
  description: string;
  amount: number;
  type: 'invoice' | 'labour' | 'material' | 'subcontract' | 'other';
}

const LS_PREFIX = 'job_costs_';

export function lsLoadJobCosts(projectId: string): CostEntry[] {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey(`${LS_PREFIX}${projectId}`)) || '[]');
  } catch { return []; }
}

export function lsSaveJobCosts(projectId: string, entries: CostEntry[]): void {
  localStorage.setItem(getUserStorageKey(`${LS_PREFIX}${projectId}`), JSON.stringify(entries));
}

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function toRow(entry: CostEntry, projectId: string, userId: string) {
  return {
    id: entry.id,
    project_id: projectId,
    user_id: userId,
    date: entry.date,
    trade: entry.trade,
    supplier: entry.supplier,
    description: entry.description,
    amount: entry.amount,
    type: entry.type,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: any): CostEntry {
  return {
    id: row.id,
    date: row.date,
    trade: row.trade,
    supplier: row.supplier,
    description: row.description,
    amount: Number(row.amount),
    type: row.type as CostEntry['type'],
  };
}

export async function syncJobCostsToSupabase(projectId: string, entries: CostEntry[]): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  try {
    const { error: delErr } = await supabase
      .from('job_cost_entries')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (delErr) return;
    if (entries.length === 0) return;
    await supabase.from('job_cost_entries').insert(entries.map(e => toRow(e, projectId, userId)));
  } catch { /* silent */ }
}

export async function loadJobCostsFromSupabase(projectId: string): Promise<CostEntry[]> {
  const userId = await getUserId();
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('job_cost_entries')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map(fromRow);
  } catch { return []; }
}

export async function loadJobCostsMerged(projectId: string): Promise<CostEntry[]> {
  const [dbEntries, lsEntries] = await Promise.all([
    loadJobCostsFromSupabase(projectId),
    Promise.resolve(lsLoadJobCosts(projectId)),
  ]);
  if (dbEntries.length > 0) {
    lsSaveJobCosts(projectId, dbEntries);
    return dbEntries;
  }
  if (lsEntries.length > 0) {
    syncJobCostsToSupabase(projectId, lsEntries);
  }
  return lsEntries;
}
