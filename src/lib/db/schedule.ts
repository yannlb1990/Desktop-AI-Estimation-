import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';

export interface ScheduleTask {
  id: string;
  name: string;
  trade: string;
  color: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  progress: number;
  notes: string;
  sowRef?: string;
}

// ─── localStorage helpers (migration only — not used for primary reads/writes) ─

const LS_PREFIX = 'schedule_';

function lsLoad(projectId: string): ScheduleTask[] {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey(`${LS_PREFIX}${projectId}`)) || 'null') ?? [];
  } catch { return []; }
}

function lsClear(projectId: string): void {
  localStorage.removeItem(getUserStorageKey(`${LS_PREFIX}${projectId}`));
}

// Keep exported for any legacy callers that still reference it — safe no-op
export function lsSaveSchedule(_projectId: string, _tasks: ScheduleTask[]): void {}

// ─── Row mapping ──────────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function toRow(task: ScheduleTask, projectId: string, userId: string, sortOrder: number) {
  return {
    id: task.id,
    project_id: projectId,
    user_id: userId,
    name: task.name,
    trade: task.trade,
    color: task.color,
    start_date: task.startDate,
    end_date: task.endDate,
    duration_days: task.durationDays,
    progress: task.progress,
    notes: task.notes,
    sow_ref: task.sowRef ?? null,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: any): ScheduleTask {
  return {
    id: row.id,
    name: row.name,
    trade: row.trade,
    color: row.color,
    startDate: row.start_date,
    endDate: row.end_date,
    durationDays: row.duration_days,
    progress: row.progress,
    notes: row.notes,
    sowRef: row.sow_ref ?? undefined,
  };
}

// ─── Supabase read/write ──────────────────────────────────────────────────────

export async function syncScheduleToSupabase(projectId: string, tasks: ScheduleTask[]): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  try {
    if (tasks.length === 0) {
      const { error } = await supabase
        .from('schedule_tasks')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      if (error) console.error('[syncSchedule] delete-all failed:', error.message);
      return;
    }

    const { error: upsertErr } = await supabase
      .from('schedule_tasks')
      .upsert(
        tasks.map((t, i) => toRow(t, projectId, userId, i)),
        { onConflict: 'id' }
      );
    if (upsertErr) {
      console.error('[syncSchedule] upsert failed:', upsertErr.message);
      return;
    }

    // Remove rows no longer in the task list
    const { error: pruneErr } = await supabase
      .from('schedule_tasks')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .not('id', 'in', `(${tasks.map(t => t.id).join(',')})`);
    if (pruneErr) console.error('[syncSchedule] prune failed:', pruneErr.message);
  } catch (e) {
    console.error('[syncSchedule] failed:', e instanceof Error ? e.message : e);
  }
}

export async function loadScheduleFromSupabase(projectId: string): Promise<ScheduleTask[] | null> {
  const userId = await getUserId();
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('schedule_tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('sort_order', { ascending: true });
    if (error || !data) return null;
    return data.map(fromRow);
  } catch { return null; }
}

// ─── Primary load: Supabase first, one-time localStorage migration ────────────

export async function loadScheduleMerged(projectId: string): Promise<ScheduleTask[] | null> {
  const dbTasks = await loadScheduleFromSupabase(projectId);

  // Supabase has data — use it as source of truth
  if (dbTasks !== null && dbTasks.length > 0) return dbTasks;

  // Supabase empty — check localStorage for legacy data to migrate
  const lsTasks = lsLoad(projectId);
  if (lsTasks.length > 0) {
    // One-time migration: push to Supabase, wipe localStorage entry
    syncScheduleToSupabase(projectId, lsTasks);
    lsClear(projectId);
    return lsTasks;
  }

  // Genuinely no data yet
  return dbTasks; // null if Supabase errored, [] if it returned empty
}
