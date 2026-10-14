import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';

export interface OverheadItemRow {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  notes: string;
}

export const overheadItemsKey = (projectId: string) => getUserStorageKey(`overhead_items_${projectId}`);

/** This device's copy of a project's overhead items, or null when it never had any. */
export function localOverheadItems(projectId: string): OverheadItemRow[] | null {
  try {
    const raw = localStorage.getItem(overheadItemsKey(projectId));
    if (raw == null) return null;
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : null;
  } catch {
    return null;
  }
}

const sumAmounts = (rows: { amount?: number | string }[]) =>
  rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

/** Replace a project's overhead items in the cloud. Never throws. */
export async function saveOverheadItemsToCloud(projectId: string, items: OverheadItemRow[]): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('overhead_items').delete()
      .eq('project_id', projectId).eq('user_id', session.user.id);
    if (items.length > 0) {
      await supabase.from('overhead_items').insert(
        items.map((item, i) => ({
          id: item.id, project_id: projectId, user_id: session.user.id,
          name: item.name, category: item.category, amount: item.amount,
          frequency: item.frequency, notes: item.notes, sort_order: i,
        }))
      );
    }
  } catch { /* retried on the next change or reconcile */ }
}

/**
 * The real fixed-overhead total for a project, given the cached project.overhead_total
 * and the project's rows in the cloud overhead_items table.
 *
 * This device's own item list wins when it agrees with the cache: it holds edits whose
 * cloud save may not have landed yet, and those rows are pushed up again. Otherwise the
 * cloud list is the truth (edits made on another device, or a stale cache with no items).
 */
export function resolveOverheadTotal(
  projectId: string,
  cached: number,
  cloudRows: { amount?: number | string }[],
): { total: number; pushLocal: OverheadItemRow[] | null } {
  const cloud = sumAmounts(cloudRows);
  const local = localOverheadItems(projectId);
  if (local && Math.abs(sumAmounts(local) - cached) < 0.005 && Math.abs(cloud - cached) >= 0.005) {
    return { total: cached, pushLocal: local };
  }
  return { total: cloud, pushLocal: null };
}
