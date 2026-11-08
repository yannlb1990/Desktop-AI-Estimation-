/**
 * Roofing quantities from a building's size, pitch and roof shape (gable or hip), or
 * from lengths the roofer enters. The roof surface is the plan area divided by cos(pitch);
 * hips and barges run along the slope. Each quantity can be overwritten before adding.
 * Prices come from the scope library (src/data/tradeScopes.ts).
 */
import { findScope, scopeRate } from '@/data/tradeScopes';
import type { PackLine } from '@/lib/estimate/roomPacks';

export type RoofShape = 'gable' | 'hip' | 'skillion';
export type RoofMaterial = 'colorbond' | 'concrete tile' | 'terracotta';

export interface RoofInput {
  /** building footprint, outside of walls (m) */
  lengthM: number;
  widthM: number;
  /** eaves overhang each side (m) */
  eavesM: number;
  pitchDeg: number;
  shape: RoofShape;
  material: RoofMaterial;
  wastePct: number;
  /** ridges, hips, valleys etc. when the roof is not a simple rectangle (they replace the worked-out ones) */
  overrides?: Partial<Record<RoofQtyKey, number>>;
  valleysLm: number;
  wallFlashingLm: number;
  downpipes: number;
  penetrations: number;
  skylights: number;
  vents: number;
  removeExisting: boolean;
  insulation: boolean;
}

export type RoofQtyKey = 'roofArea' | 'ridge' | 'hips' | 'barge' | 'gutter';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The roof's own quantities, worked out from the building size and pitch. */
export function roofGeometry(i: Pick<RoofInput, 'lengthM' | 'widthM' | 'eavesM' | 'pitchDeg' | 'shape'>): Record<RoofQtyKey, number> & { pitchFactor: number; planArea: number } {
  const o = Math.max(0, i.eavesM || 0);
  const L = Math.max(0, i.lengthM || 0) + 2 * o;
  const W = Math.max(0, i.widthM || 0) + 2 * o;
  const p = (Math.max(0, Math.min(75, i.pitchDeg || 0)) * Math.PI) / 180;
  const pitchFactor = 1 / Math.cos(p);
  const planArea = L * W;
  const run = W / 2;
  const rafter = run * pitchFactor;                       // eaves to ridge along the slope
  // a hip runs on the diagonal: run in both directions, then up the rise
  const hipLen = Math.sqrt(run * run + run * run + (run * Math.tan(p)) ** 2);
  if (i.shape === 'skillion') {
    // one slope across the width: no ridge or hips, barges both ends, gutter on the low side
    return { roofArea: r2(planArea * pitchFactor), ridge: 0, hips: 0, barge: r2(2 * W * pitchFactor), gutter: r2(L), pitchFactor, planArea: r2(planArea) };
  }
  if (i.shape === 'gable') {
    return { roofArea: r2(planArea * pitchFactor), ridge: r2(L), hips: 0, barge: r2(4 * rafter), gutter: r2(2 * L), pitchFactor, planArea: r2(planArea) };
  }
  return { roofArea: r2(planArea * pitchFactor), ridge: r2(Math.max(0, L - W)), hips: r2(4 * hipLen), barge: 0, gutter: r2(2 * (L + W)), pitchFactor, planArea: r2(planArea) };
}

export function roofLines(i: RoofInput, state?: string | null, area = 'Roof'): PackLine[] {
  const g = { ...roofGeometry(i), ...(i.overrides ?? {}) };
  const out: PackLine[] = [];
  const add = (scope: string, qty: number) => {
    const q = r2(qty);
    if (!(q > 0)) return;
    const lib = findScope('Roofing', scope);
    if (!lib) throw new Error(`no roofing scope "${scope}"`);
    out.push({ area, trade: 'Roofing', scope: lib.name, unit: lib.unit, quantity: q, unitPrice: scopeRate(lib, state) });
  };
  const sheeted = g.roofArea * (1 + Math.max(0, i.wastePct || 0) / 100);
  if (i.removeExisting) add('Remove existing roof', g.roofArea);
  add(i.material === 'colorbond' ? 'Colorbond roofing' : i.material === 'terracotta' ? 'Terracotta roof tiles' : 'Concrete roof tiles', sheeted);
  add('Sarking', g.roofArea);
  if (i.material !== 'colorbond') add('Roof battens', g.roofArea);
  if (i.insulation && i.material === 'colorbond') add('Roof insulation blanket', g.roofArea);
  add('Ridge and hip capping', g.ridge + g.hips);
  add('Valley gutter', i.valleysLm);
  add('Barge flashing', g.barge);
  add('Apron and wall flashing', i.wallFlashingLm);
  add('Fascia and gutter', g.gutter);
  add('Downpipes', i.downpipes);
  add('Penetration flashing', i.penetrations);
  add('Skylight supply and install', i.skylights);
  add('Roof vent (whirlybird)', i.vents);
  return out;
}

export const defaultRoof = (): RoofInput => ({
  lengthM: 16, widthM: 10, eavesM: 0.45, pitchDeg: 22.5, shape: 'hip', material: 'colorbond', wastePct: 5,
  valleysLm: 0, wallFlashingLm: 0, downpipes: 4, penetrations: 2, skylights: 0, vents: 1, removeExisting: false, insulation: true,
});
