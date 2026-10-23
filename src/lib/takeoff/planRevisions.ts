/**
 * Revision history of a project's plan, kept on the project record (synced with it), so the
 * previous issue can be overlaid on the current one from any device.
 */
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';

export interface PlanRevision {
  /** the plan that replaced it */
  toPlanId: string;
  fromPlanId: string;
  fromName: string;
  /** storage:plan-pdfs/... path of the previous issue, when it was saved to the cloud */
  fromStoragePath?: string;
  at: string;
  /** how many measurements moved across */
  carried: number;
}

const read = (): any[] => {
  try { return JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]'); } catch { return []; }
};

export function planRevisions(projectId: string): PlanRevision[] {
  return read().find(p => p.id === projectId)?.plan_revisions ?? [];
}

/** The revision the current plan replaced, if any. */
export function previousRevisionOf(projectId: string, planId: string | undefined): PlanRevision | undefined {
  if (!planId) return undefined;
  return [...planRevisions(projectId)].reverse().find(r => r.toPlanId === planId);
}

export function recordRevision(projectId: string, rev: PlanRevision): void {
  const projects = read();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  projects[idx].plan_revisions = [...(projects[idx].plan_revisions ?? []), rev];
  localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
  syncProjectToSupabase(projects[idx]);
}
