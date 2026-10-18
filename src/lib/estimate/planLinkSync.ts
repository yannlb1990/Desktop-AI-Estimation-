/**
 * Keeps the saved estimate in step with the takeoff measurements.
 * Called by the takeoff whenever its measurements change (after the cloud copy has
 * been checked), so linked lines update live, locally and in Supabase.
 */
import type { Measurement, CostItem } from '@/lib/takeoff/types';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { applyMeasurements, createPlanLink, remapMeasurementIds, type PlanChange } from './planLinks';
import { addCostItemsToEstimate } from './fromCostItem';

function readProjects(): any[] {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
  } catch {
    return [];
  }
}

function writeProject(projects: any[], idx: number): void {
  localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
  syncProjectToSupabase(projects[idx]);
  window.dispatchEvent(new CustomEvent('estimate-updated', { detail: { projectId: projects[idx].id, source: 'plan' } }));
}

/**
 * One-time upgrade of an existing project: lines that were sent from the Costs tab
 * get linked to the measurements their cost item came from, keeping today's
 * quantity (so no total changes), and AI lines are labelled as AI.
 */
function backfillLinks(project: any, measurements: Measurement[], costItems: CostItem[]): boolean {
  if (project.plan_links_v1) return false;
  const byCostId = new Map(costItems.map(c => [c.id, c]));
  project.estimate_items = (project.estimate_items || []).map((item: any) => {
    if (item.plan_link || item.source) return item;
    const cost = item._costItemId ? byCostId.get(item._costItemId) : undefined;
    const ids = cost?.linkedMeasurements ?? [];
    if (ids.length) {
      const link = createPlanLink(ids, Number(item.quantity) || 0, measurements, item.unit);
      if (link.measurementIds.length) return { ...item, source: 'plan', plan_link: link };
    }
    if (typeof item.id === 'string' && item.id.startsWith('EST-')) return { ...item, source: 'ai' };
    return { ...item, source: 'manual' };
  });
  project.plan_links_v1 = true;
  return true;
}

export function syncEstimateWithMeasurements(
  projectId: string,
  measurements: Measurement[],
  costItems: CostItem[] = [],
): PlanChange[] {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return [];
  const project = projects[idx];
  if (!Array.isArray(project.estimate_items)) return [];

  const upgraded = backfillLinks(project, measurements, costItems);
  const { items, changes } = applyMeasurements(project.estimate_items, measurements);
  const touched = items.some((it, i) => it !== project.estimate_items[i]);
  if (!upgraded && !touched) return [];

  project.estimate_items = items;
  writeProject(projects, idx);
  return changes;
}

/** Measurements were combined into one: keep every linked line attached to the result. */
export function remapLinkedMeasurements(projectId: string, oldIds: string[], combined: Measurement, measurements: Measurement[]): void {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1 || !Array.isArray(projects[idx].estimate_items)) return;
  const before = JSON.stringify(projects[idx].estimate_items);
  projects[idx].estimate_items = remapMeasurementIds(projects[idx].estimate_items, oldIds, combined, measurements);
  if (JSON.stringify(projects[idx].estimate_items) !== before) writeProject(projects, idx);
}

/** User acknowledged the "updated from plan" marker on a line. */
export function acknowledgePlanChange(projectId: string, itemId: string): void {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  projects[idx].estimate_items = (projects[idx].estimate_items || []).map((it: any) =>
    it.id === itemId && it.plan_link ? { ...it, plan_link: { ...it.plan_link, changedFrom: undefined, changedAt: undefined } } : it,
  );
  writeProject(projects, idx);
}

/**
 * Takeoff items flow straight into the Estimate: every cost item added in the takeoff
 * becomes an estimate line once. Remembered in project.takeoff_added so a line you
 * delete from the Estimate never comes back.
 *
 * First run on an existing project: items that were never sent are NOT added
 * (that would change totals silently); they're listed as suggestions instead.
 */
export function flowTakeoffIntoEstimate(projectId: string, measurements: Measurement[], costItems: CostItem[]): string[] {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return [];
  const project = projects[idx];
  const inEstimate = new Set((project.estimate_items || []).map((e: any) => e._costItemId).filter(Boolean));

  if (!project.takeoff_merge_v1) {
    project.takeoff_merge_v1 = true;
    project.takeoff_added = costItems.filter(c => inEstimate.has(c.id)).map(c => c.id);
    project.takeoff_suggestions = costItems.filter(c => !inEstimate.has(c.id)).map(c => c.id);
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
    syncProjectToSupabase(project);
    return [];
  }

  const done = new Set<string>([...(project.takeoff_added || []), ...(project.takeoff_suggestions || [])]);
  const fresh = costItems.filter(c => !done.has(c.id) && !inEstimate.has(c.id));
  if (fresh.length === 0) return [];
  const added = addCostItemsToEstimate(projectId, fresh, measurements);
  markTakeoffAdded(projectId, fresh.map(c => c.id));
  return added;
}

/** Remember cost items as handled (added, or accepted/dismissed from suggestions). */
export function markTakeoffAdded(projectId: string, costItemIds: string[], fromSuggestions = false): void {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  const p = projects[idx];
  p.takeoff_added = [...new Set([...(p.takeoff_added || []), ...costItemIds])];
  if (fromSuggestions) {
    const drop = new Set(costItemIds);
    p.takeoff_suggestions = (p.takeoff_suggestions || []).filter((id: string) => !drop.has(id));
  }
  localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
  syncProjectToSupabase(p);
}

/**
 * A wall set up again (Wall Setup on a wall already in the estimate): drop the estimate
 * lines that came from its previous takeoff items, so the new set replaces them instead
 * of piling on top (lining counted on 3 faces) or being skipped as duplicates.
 */
export function removeEstimateLinesForCostItems(projectId: string, costItemIds: string[]): void {
  if (costItemIds.length === 0) return;
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  const drop = new Set(costItemIds);
  const p = projects[idx];
  p.estimate_items = (p.estimate_items || []).filter((e: any) => !drop.has(e._costItemId));
  p.takeoff_added = (p.takeoff_added || []).filter((id: string) => !drop.has(id));
  p.takeoff_suggestions = (p.takeoff_suggestions || []).filter((id: string) => !drop.has(id));
  writeProject(projects, idx);
}
