/**
 * Live link between estimate lines and takeoff measurements.
 *
 * A plan-linked line stores the exact measurement IDs it was built from and a
 * factor (e.g. 2 for plasterboard on both faces of a wall). Its quantity is always
 *   factor × Σ effective quantity of those measurements.
 * When a measurement changes, every line linked to that measurement ID updates.
 * Links are by ID only: a newly drawn measurement (another wall) never attaches
 * to an existing line; it becomes a new suggestion instead.
 *
 * Pure functions here; storage glue is in planLinkSync.ts.
 */
import type { Measurement } from '@/lib/takeoff/types';
import { getEffectiveQuantity } from '@/lib/takeoff/calculations';

export type EstimateLineSource = 'plan' | 'ai' | 'manual';

export interface PlanLink {
  /** Measurement IDs this line's quantity comes from */
  measurementIds: string[];
  /** Quantity per unit of measured quantity (2 = both faces, 1.1 = +10%) */
  factor: number;
  /** Measured total the last time the line was synced */
  baseQty: number;
  /** Linked to the measurement but the quantity never scales (a pump hire, truck loads) */
  fixedQty?: boolean;
  /** Follow the measurement as drawn (slab area), not its derived volume: mesh, chairs,
   *  membrane and edge forms don't change when only the slab thickness changes */
  raw?: boolean;
  /** All linked measurements have been deleted: quantity frozen, needs attention */
  broken?: boolean;
  /** Set when the plan changed the quantity; cleared when the user acknowledges */
  changedFrom?: number;
  changedAt?: string;
  /** 2 = base measured in the line's own unit (length for metre lines, etc.) */
  v?: 2;
}

export interface LinkableItem {
  id: string;
  quantity: number;
  unit?: string;
  labour_hours?: number;
  source?: EstimateLineSource;
  plan_link?: PlanLink | null;
}

const round = (n: number, dp = 3) => Math.round(n * 10 ** dp) / 10 ** dp;

type UnitKind = 'LM' | 'M2' | 'M3' | 'EA' | 'OTHER';

export function unitKind(unit?: string): UnitKind {
  const u = String(unit ?? '').trim().toLowerCase().replace('²', '2').replace('³', '3');
  if (['lm', 'm', 'lin m', 'linear m', 'l/m'].includes(u)) return 'LM';
  if (['m2', 'sqm', 'sq m'].includes(u)) return 'M2';
  if (['m3', 'cum', 'cu m'].includes(u)) return 'M3';
  if (['ea', 'each', 'no', 'no.', 'count', 'item', 'items', 'nr'].includes(u)) return 'EA';
  return 'OTHER';
}

/**
 * The amount of a measurement a line follows, in the line's own unit:
 * a metre line on a wall follows its length (not its area), an m² line on a
 * concrete slab follows its area (not its volume). Otherwise the measurement's
 * effective quantity (wall m², slab m³, count, length, area).
 */
export function measuredValueFor(m: Measurement, lineUnit?: string, raw = false): number {
  if (raw) return m.realValue || 0;
  const want = unitKind(lineUnit);
  const have = unitKind(m.unit);
  if (want === 'LM' && have === 'LM') return m.realValue || 0;
  if (want === 'M2' && have === 'M2') return m.realValue || 0;
  // Counts on a wall (studs) go with its length, not its area
  if (want === 'EA' && have === 'LM') return m.realValue || 0;
  return getEffectiveQuantity(m) || 0;
}

export function measuredBase(ids: string[], byId: Map<string, Measurement>, lineUnit?: string, raw = false): { base: number; found: number } {
  let base = 0;
  let found = 0;
  for (const id of ids) {
    const m = byId.get(id);
    if (!m) continue;
    found++;
    base += measuredValueFor(m, lineUnit, raw);
  }
  return { base, found };
}

/** Link a line to measurements, keeping its current quantity (factor = qty / measured). */
export function createPlanLink(measurementIds: string[], quantity: number, measurements: Measurement[], lineUnit?: string, raw = false): PlanLink {
  const byId = new Map(measurements.map(m => [m.id, m]));
  const ids = [...new Set(measurementIds)].filter(id => byId.has(id));
  const { base } = measuredBase(ids, byId, lineUnit, raw);
  return {
    measurementIds: ids,
    factor: base > 0 ? quantity / base : 1,
    baseQty: round(base),
    v: 2,
    ...(raw ? { raw: true } : {}),
  };
}

/** The user typed a new quantity on a linked line: keep it live with the new ratio. */
export function relinkWithQuantity(link: PlanLink, newQuantity: number): PlanLink {
  return {
    ...link,
    factor: link.baseQty > 0 ? newQuantity / link.baseQty : link.factor,
    changedFrom: undefined,
    changedAt: undefined,
  };
}

export interface PlanChange {
  itemId: string;
  from: number;
  to: number;
  broken?: boolean;
}

/**
 * Recalculate every linked line from the current measurements.
 * Returns new item objects only for lines that changed.
 */
export function applyMeasurements<T extends LinkableItem>(
  items: T[],
  measurements: Measurement[],
  now = new Date().toISOString(),
): { items: T[]; changes: PlanChange[] } {
  const byId = new Map(measurements.map(m => [m.id, m]));
  const changes: PlanChange[] = [];
  const next = items.map(item => {
    const link = item.plan_link;
    if (!link || !link.measurementIds?.length) return item;

    const { base, found } = measuredBase(link.measurementIds, byId, item.unit, !!link.raw);
    if (link.v !== 2 && found > 0) {
      // Link made before bases followed the line's unit: re-base it, quantity unchanged
      return { ...item, plan_link: { ...link, v: 2 as const, factor: base > 0 ? (Number(item.quantity) || 0) / base : link.factor, baseQty: round(base) } };
    }
    if (found === 0) {
      // Every linked measurement was deleted: never drop the price to $0 silently
      if (link.broken) return item;
      changes.push({ itemId: item.id, from: item.quantity, to: item.quantity, broken: true });
      return { ...item, plan_link: { ...link, broken: true } };
    }

    if (link.fixedQty) return link.broken ? { ...item, plan_link: { ...link, broken: false } } : item;

    const newQty = round(link.factor * base, 3);
    const baseChanged = Math.abs(round(base) - link.baseQty) > 0.0005;
    if (!baseChanged && !link.broken) return item;

    const oldQty = Number(item.quantity) || 0;
    const qtyChanged = Math.abs(newQty - oldQty) > 0.0005;
    const scale = oldQty > 0 ? newQty / oldQty : 1;
    if (qtyChanged) changes.push({ itemId: item.id, from: oldQty, to: newQty });
    return {
      ...item,
      quantity: newQty,
      // Labour on a line is total hours: it scales with the quantity
      labour_hours: item.labour_hours != null && qtyChanged && oldQty > 0
        ? round((item.labour_hours || 0) * scale, 3)
        : item.labour_hours,
      plan_link: {
        ...link,
        baseQty: round(base),
        broken: false,
        changedFrom: qtyChanged ? (link.changedFrom ?? oldQty) : link.changedFrom,
        changedAt: qtyChanged ? now : link.changedAt,
      },
    };
  });
  return { items: next, changes };
}

/**
 * Measurements were combined into one new measurement. Every line linked to any of
 * the old IDs now follows the new one, re-based so its quantity is unchanged at the
 * moment of combining. That way two lines that covered W1 and W2 separately don't
 * both jump to the combined length; later edits to the combined measurement scale
 * each of them proportionally.
 */
export function remapMeasurementIds<T extends LinkableItem>(
  items: T[],
  oldIds: string[],
  combined: Measurement,
  measurements: Measurement[],
): T[] {
  const old = new Set(oldIds);
  const byId = new Map(measurements.map(m => [m.id, m]));
  byId.set(combined.id, combined);
  return items.map(item => {
    const link = item.plan_link;
    if (!link || !link.measurementIds.some(id => old.has(id))) return item;
    const ids = [...new Set(link.measurementIds.map(id => (old.has(id) ? combined.id : id)))];
    const { base } = measuredBase(ids, byId, item.unit, !!link.raw);
    return {
      ...item,
      plan_link: {
        ...link,
        measurementIds: ids,
        factor: base > 0 ? (Number(item.quantity) || 0) / base : link.factor,
        baseQty: round(base),
        broken: false,
        v: 2 as const,
      },
    };
  });
}

export function lineSource(item: { source?: EstimateLineSource; plan_link?: PlanLink | null; id?: string }): EstimateLineSource {
  if (item.plan_link?.measurementIds?.length) return 'plan';
  if (item.source) return item.source;
  return 'manual';
}
