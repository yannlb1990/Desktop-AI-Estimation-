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
}

const LS_PREFIX = 'schedule_';

export function lsLoadSchedule(projectId: string): ScheduleTask[] {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey(`${LS_PREFIX}${projectId}`)) || 'null') ?? [];
  } catch { return []; }
}

export function lsSaveSchedule(projectId: string, tasks: ScheduleTask[]): void {
  localStorage.setItem(getUserStorageKey(`${LS_PREFIX}${projectId}`), JSON.stringify(tasks));
}

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function toRow(task: ScheduleTask, projectId: string, userId: string) {
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
  };
}

export async function syncScheduleToSupabase(projectId: string, tasks: ScheduleTask[]): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  try {
    const { error: delErr } = await supabase
      .from('schedule_tasks')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (delErr) return;
    if (tasks.length === 0) return;
    await supabase.from('schedule_tasks').insert(tasks.map(t => toRow(t, projectId, userId)));
  } catch { /* silent — localStorage is source of truth */ }
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

export async function loadScheduleMerged(projectId: string): Promise<ScheduleTask[] | null> {
  const [dbTasks, lsTasks] = await Promise.all([
    loadScheduleFromSupabase(projectId),
    Promise.resolve(lsLoadSchedule(projectId)),
  ]);
  if (dbTasks === null) return lsTasks.length > 0 ? lsTasks : null;
  if (dbTasks.length > 0) {
    lsSaveSchedule(projectId, dbTasks);
    return dbTasks;
  }
  if (lsTasks.length > 0) {
    syncScheduleToSupabase(projectId, lsTasks);
    return lsTasks;
  }
  return null;
}
