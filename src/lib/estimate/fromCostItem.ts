/**
 * The one way takeoff items become Estimate lines.
 *
 * Everything added from the plan (measurements, walls, doors/windows, AI panel,
 * frame estimator, recipes, library) arrives as a CostItem; this turns it into an
 * estimate line, linked to its measurements so the quantity stays live.
 */
import type { CostItem, Measurement } from '@/lib/takeoff/types';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { calculateProjectTotals, priceLine, resolveProjectPricing } from '@/lib/pricing/estimatePricing';
import { readUserPricingDefaults } from '@/lib/pricing/userPricingDefaults';
import { isMeasurementValueLabel, workLabelForMeasurement, isGenericScope } from '@/lib/takeoff/scopeLabels';
import { createPlanLink } from './planLinks';
import { knownTradeName } from '@/data/labourRates';

/** Map a CostItem category to the nearest AU trade */
export const CATEGORY_TO_TRADE: Record<string, string> = {
  Framing: 'Carpenter', Lining: 'Plasterer', Insulation: 'Carpenter',
  Flooring: 'Tiler', Painting: 'Painter', Waterproofing: 'Tiler',
  Roofing: 'Roofer', Concrete: 'Concreter', Plumbing: 'Plumber',
  Electrical: 'Electrician', Brickwork: 'Bricklayer', Landscaping: 'Landscaper',
  General: 'Carpenter',
};

export function costItemToEstimateLine(
  item: CostItem,
  measurements: Measurement[],
  opts: { itemNumber: number; materialWastePct: number; labourWastePct: number; markupPct?: number },
): any {
  const linkedIds = item.linkedMeasurements ?? [];
  const link = linkedIds.length ? createPlanLink(linkedIds, item.quantity, measurements, item.unit, !!item.followsDrawnQuantity) : null;
  const linked = !!link && link.measurementIds.length > 0;
  // A plan line named only after its measurement ("Kitchen floor", "Wall") says where,
  // not what work: keep the name as a note and let the Estimate ask for the scope.
  const source = linked ? measurements.find(m => m.id === link!.measurementIds[0]) : undefined;
  const namedAfterMeasurement = !!source && (
    isGenericScope(item.name) ||
    (!!source.label && source.label.trim().toLowerCase() === String(item.name ?? '').trim().toLowerCase())
  );
  const scope = namedAfterMeasurement
    ? (source!.measurementType && source!.measurementType !== 'Other' ? source!.measurementType : 'Measured area')
    : isMeasurementValueLabel(item.name)
      ? workLabelForMeasurement({ measurementType: item.measurementType ?? (item.category !== 'General' ? item.category : null), area: item.area, unit: item.unit })
      : (item.name || item.category);
  return {
    id: `ci-${item.id}`,
    _costItemId: item.id,
    source: linked ? 'plan' : item.rateId ? 'ai' : 'manual',
    plan_link: linked ? (item.fixedQuantity ? { ...link!, fixedQty: true } : link) : null,
    section_id: null,
    area: item.area || '',
    // The item's own trade wins when it is a real labour trade (batts: Insulation, trench: Civil /
    // Excavation); 'General' or an AI category falls back to the category map as before
    trade: knownTradeName(item.trade) ?? CATEGORY_TO_TRADE[item.category] ?? item.trade ?? 'Carpenter',
    // The scope says what the work is, never the measured size or its name
    scope_of_work: scope,
    material_type: item.customMaterial || item.material || (isMeasurementValueLabel(item.name) || namedAfterMeasurement ? '' : item.name) || '',
    quantity: Math.round((Number(item.quantity) || 0) * 1000) / 1000,
    unit: item.unit,
    unit_price: item.unitCost,
    labour_hours: item.labourHours ?? 0,
    labour_rate: item.hourlyRate ?? 65,
    labour_rate_override: !!item.hourlyRateOverride,
    material_wastage_pct: item.materialWastePercent ?? opts.materialWastePct,
    labour_wastage_pct: item.labourWastePercent ?? opts.labourWastePct,
    // the project's markup on new lines (Estimate Configuration), unless the item set its own
    markup_pct: item.markupPercent ?? opts.markupPct ?? 0,
    notes: item.description || item.notes || (namedAfterMeasurement && source?.label ? source.label : ''),
    expanded: false,
    item_number: `${opts.itemNumber}`,
    isEditing: false,
    relatedMaterials: (item.relatedMaterials || [])
      .filter(rm => rm.isAccepted)
      .map(rm => ({ ...rm, unit_price: rm.unitCost ?? 0, confirmed: true })),
    _transferredAt: Date.now(),
  };
}

/**
 * Add takeoff items to the project's estimate. Items already in it (same cost item)
 * are skipped. Returns the IDs of the lines added.
 */
export function addCostItemsToEstimate(projectId: string, items: CostItem[], measurements: Measurement[]): string[] {
  if (items.length === 0) return [];
  const key = getUserStorageKey('local_projects');
  const projects: any[] = JSON.parse(localStorage.getItem(key) || '[]');
  let idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) {
    projects.push({ id: projectId, estimate_items: [] });
    idx = projects.length - 1;
  }
  const project = projects[idx];
  const existing: any[] = project.estimate_items || [];
  const have = new Set(existing.map(e => e._costItemId).filter(Boolean));
  const materialWastePct = project.estimate_config?.materialWastage ?? 10;
  const labourWastePct = project.estimate_config?.labourWastage ?? 5;
  const markupPct = resolveProjectPricing(project, readUserPricingDefaults(project)).config.defaultMarkup;

  const added: any[] = [];
  for (const item of items) {
    if (have.has(item.id)) continue;
    have.add(item.id);
    added.push(costItemToEstimateLine(item, measurements, {
      itemNumber: existing.length + added.length + 1,
      materialWastePct,
      labourWastePct,
      markupPct,
    }));
  }
  if (added.length === 0) return [];

  project.estimate_items = [...existing, ...added];
  project.estimate_totals = calculateProjectTotals(project, readUserPricingDefaults(project));
  localStorage.setItem(key, JSON.stringify(projects));
  syncProjectToSupabase(project);
  window.dispatchEvent(new CustomEvent('estimate-updated', { detail: { projectId } }));
  return added.map(a => a.id);
}

/** Remove lines (e.g. undo of an add). */
export function removeEstimateLines(projectId: string, lineIds: string[]): void {
  const key = getUserStorageKey('local_projects');
  const projects: any[] = JSON.parse(localStorage.getItem(key) || '[]');
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  const drop = new Set(lineIds);
  projects[idx].estimate_items = (projects[idx].estimate_items || []).filter((e: any) => !drop.has(e.id));
  projects[idx].estimate_totals = calculateProjectTotals(projects[idx], readUserPricingDefaults(projects[idx]));
  localStorage.setItem(key, JSON.stringify(projects));
  syncProjectToSupabase(projects[idx]);
  window.dispatchEvent(new CustomEvent('estimate-updated', { detail: { projectId } }));
}

/**
 * Estimate lines shaped as CostItems, for the BOQ / SOW / supplier-quote tools.
 * Line totals come from the shared pricing so exports match the Estimate.
 */
export function estimateLinesAsCostItems(project: any): CostItem[] {
  const lines: any[] = project?.estimate_items || [];
  const { config, labourRates } = resolveProjectPricing(project, readUserPricingDefaults(project));
  return lines.map(l => ({
    id: l.id,
    name: l.scope_of_work || l.material_type || 'Item',
    description: l.material_type && l.material_type !== l.scope_of_work ? l.material_type : (l.notes || ''),
    category: l.trade || 'General',
    trade: l.trade,
    area: l.area,
    unit: l.unit,
    quantity: Number(l.quantity) || 0,
    unitCost: Number(l.unit_price) || 0,
    wasteFactor: 1,
    materialWastePercent: l.material_wastage_pct,
    labourWastePercent: l.labour_wastage_pct,
    labourHours: Number(l.labour_hours) || 0,
    hourlyRate: priceLine(l, config, labourRates).labourRate,
    subtotal: priceLine(l, config, labourRates).total,
    linkedMeasurements: l.plan_link?.measurementIds ?? [],
    notes: l.notes,
  } as unknown as CostItem));
}
