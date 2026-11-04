import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';

export type VariationStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'disputed';
export type UnitType = 'm' | 'm²' | 'm³' | 'lm' | 'ea' | 'hr' | 'ls' | 'kg';

export interface VariationItem {
  id: string;
  description: string;
  qty: number;
  unit: UnitType;
  rate: number;
  amount: number;
}

export interface Variation {
  id: string;
  number: number;
  title: string;
  description: string;
  reason: string;
  status: VariationStatus;
  items: VariationItem[];
  notes: string;
  totalAmount: number;
  /** trade from the one trade list; an approved variation adds to its budget */
  trade?: string;
  /** what the work costs the builder, ex GST; empty means not entered */
  costAmount?: number;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

const LS_PREFIX = 'variations_';

export function lsLoadVariations(projectId: string): Variation[] {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey(`${LS_PREFIX}${projectId}`)) || '[]');
  } catch { return []; }
}

export function lsSaveVariations(projectId: string, variations: Variation[]): void {
  localStorage.setItem(getUserStorageKey(`${LS_PREFIX}${projectId}`), JSON.stringify(variations));
}

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function toRow(v: Variation, projectId: string, userId: string) {
  return {
    id: v.id,
    project_id: projectId,
    user_id: userId,
    number: v.number,
    title: v.title,
    description: v.description,
    reason: v.reason,
    status: v.status,
    items: v.items as unknown as any,
    notes: v.notes,
    total_amount: v.totalAmount,
    trade: v.trade ?? null,
    cost_amount: v.costAmount ?? null,
    approved_at: v.approvedAt ?? null,
    rejected_at: v.rejectedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: any): Variation {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    reason: row.reason,
    status: row.status as VariationStatus,
    items: (row.items as VariationItem[]) ?? [],
    notes: row.notes,
    totalAmount: Number(row.total_amount),
    trade: row.trade ?? undefined,
    costAmount: row.cost_amount == null ? undefined : Number(row.cost_amount),
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
  };
}

export async function syncVariationsToSupabase(projectId: string, variations: Variation[]): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  try {
    const { error: delErr } = await supabase
      .from('variations')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (delErr) return;
    if (variations.length === 0) return;
    const rows = variations.map(v => toRow(v, projectId, userId));
    const { error } = await supabase.from('variations').insert(rows);
    // Before the trade/cost columns exist (migration 20261105000000), save everything else
    if (error && /trade|cost_amount|column/i.test(error.message)) {
      await supabase.from('variations').insert(rows.map(({ trade: _t, cost_amount: _c, ...r }) => r));
    }
  } catch (e) {
    console.error('[syncVariations] Supabase sync failed:', e instanceof Error ? e.message : e);
  }
}

export async function loadVariationsFromSupabase(projectId: string): Promise<Variation[]> {
  const userId = await getUserId();
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('variations')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('number', { ascending: true });
    if (error || !data) return [];
    return data.map(fromRow);
  } catch { return []; }
}

export async function loadVariationsMerged(projectId: string): Promise<Variation[]> {
  const [dbVars, lsVars] = await Promise.all([
    loadVariationsFromSupabase(projectId),
    Promise.resolve(lsLoadVariations(projectId)),
  ]);
  if (dbVars.length > 0) {
    // keep a trade or cost this device knows when the cloud copy has none
    const local = new Map(lsVars.map(v => [v.id, v]));
    const merged = dbVars.map(v => ({
      ...v,
      trade: v.trade ?? local.get(v.id)?.trade,
      costAmount: v.costAmount ?? local.get(v.id)?.costAmount,
    }));
    lsSaveVariations(projectId, merged);
    return merged;
  }
  if (lsVars.length > 0) {
    syncVariationsToSupabase(projectId, lsVars);
  }
  return lsVars;
}
