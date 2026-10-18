/**
 * Concrete and earthworks quantities from a measurement: slab on ground (with edge
 * beams), strip footings and trenches. Like wallItems, the setup dialog preview and
 * the estimate lines both come from these functions.
 *
 * Rule-of-thumb takeoff quantities (Australian practice), not an engineered design:
 * reinforcement, beam sizes and pour details come from the engineer's drawings.
 */

export type ConcreteJob = 'slab' | 'footing' | 'trench';

export interface SlabSpec {
  thicknessMm: number;
  edgeBeamWidthMm: number;   // 0 = no edge beam
  edgeBeamDepthMm: number;   // overall depth from top of slab
  meshSheetM2: number;       // effective cover of one sheet after laps
  pump: boolean;
}

export interface FootingSpec {
  widthMm: number;
  depthMm: number;
  barsPerRun: number;        // trench mesh / bar runs along the footing
}

export type SoilType = 'sand' | 'clay' | 'rock';

export interface TrenchSpec {
  widthMm: number;
  depthMm: number;
  beddingMm: number;         // sand bedding under the pipe
  soil: SoilType;
  truckM3: number;           // tipper capacity for spoil removal
}

export interface ConcreteLine {
  key: string;
  name: string;
  trade: string;
  unit: 'M3' | 'M2' | 'LM' | 'EA' | 'ITEM';
  qty: number;
  /** id in SCOPE_OF_WORK_RATES for a default price, or '' when the builder enters their own */
  rateId: string;
  /** remembered-price key: the estimator's own price for this component */
  priceKey: string;
  /** quantity does not follow the measurement (pump hire, whole truck loads) */
  fixed?: boolean;
  note: string;
}

/** Ready-mix and placement allowances */
export const CONCRETE_WASTE = 1.05;
/** SL82 / SL92 sheet 6.0 x 2.4 m less 200 mm laps each way */
export const MESH_SHEET_COVER_M2 = (6.0 - 0.2) * (2.4 - 0.2);
/** Bar chairs at about 800 mm centres each way */
export const CHAIRS_PER_M2 = 1.6;
/** Spoil swells once dug out */
export const BULKING: Record<SoilType, number> = { sand: 1.1, clay: 1.25, rock: 1.5 };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function slabLines(areaM2: number, perimeterM: number, s: SlabSpec): ConcreteLine[] {
  if (!(areaM2 > 0)) return [];
  const t = Math.max(0, s.thicknessMm) / 1000;
  const beamW = Math.max(0, s.edgeBeamWidthMm) / 1000;
  const beamExtra = Math.max(0, s.edgeBeamDepthMm / 1000 - t);
  const per = Math.max(0, perimeterM);
  const beamM3 = beamW > 0 ? per * beamW * beamExtra : 0;
  const concrete = (areaM2 * t + beamM3) * CONCRETE_WASTE;
  const lines: ConcreteLine[] = [
    { key: 'concrete', name: 'Slab concrete', trade: 'Concreter', unit: 'M3', qty: r2(concrete), rateId: 'conc-001', priceKey: 'concrete_m3',
      note: `${s.thicknessMm} mm slab${beamM3 > 0 ? ` and ${r2(beamM3)} m³ of edge beam` : ''}, plus 5%` },
    { key: 'mesh', name: 'Slab mesh', trade: 'Concreter', unit: 'EA', qty: Math.ceil(areaM2 / (s.meshSheetM2 || MESH_SHEET_COVER_M2)), rateId: '', priceKey: 'mesh_sheet',
      note: 'SL82 sheets 6.0 x 2.4 m, 200 mm laps' },
    { key: 'chairs', name: 'Bar chairs', trade: 'Concreter', unit: 'EA', qty: Math.ceil(areaM2 * CHAIRS_PER_M2), rateId: '', priceKey: 'bar_chair',
      note: 'About 800 mm centres' },
    { key: 'membrane', name: 'Vapour barrier', trade: 'Concreter', unit: 'M2', qty: r2((areaM2 + (beamW > 0 ? per * 2 * beamExtra : 0)) * 1.1), rateId: '', priceKey: 'membrane_m2',
      note: `0.2 mm polythene${beamW > 0 ? ', down the edge beams' : ''}, 10% laps` },
  ];
  if (per > 0) {
    lines.push({ key: 'edgeform', name: 'Edge formwork', trade: 'Concreter', unit: 'LM', qty: r2(per), rateId: '', priceKey: 'edgeform_lm', note: 'Slab perimeter' });
  }
  if (beamM3 > 0) {
    lines.push({ key: 'beamdig', name: 'Edge beam excavation', trade: 'Excavation', unit: 'M3', qty: r2(beamM3), rateId: 'site-001', priceKey: 'excavation_m3',
      note: `${s.edgeBeamWidthMm} wide x ${Math.round(beamExtra * 1000)} below the slab` });
    lines.push({ key: 'beamreo', name: 'Edge beam trench mesh', trade: 'Concreter', unit: 'LM', qty: r2(per * 3 * 1.05), rateId: '', priceKey: 'trenchmesh_lm',
      note: '3 runs of trench mesh around the perimeter, 5% laps' });
  }
  if (s.pump) {
    lines.push({ key: 'pump', name: 'Concrete pump', trade: 'Concreter', unit: 'ITEM', qty: 1, rateId: '', priceKey: 'pump_item', note: 'Pump hire for the pour', fixed: true });
  }
  return lines.filter(l => l.qty > 0);
}

export function footingLines(lengthM: number, f: FootingSpec): ConcreteLine[] {
  if (!(lengthM > 0)) return [];
  const m3 = lengthM * (f.widthMm / 1000) * (f.depthMm / 1000);
  return [
    { key: 'dig', name: 'Footing excavation', trade: 'Excavation', unit: 'M3', qty: r2(m3), rateId: 'site-001', priceKey: 'excavation_m3',
      note: `${f.widthMm} wide x ${f.depthMm} deep` },
    { key: 'concrete', name: 'Footing concrete', trade: 'Concreter', unit: 'M3', qty: r2(m3 * CONCRETE_WASTE), rateId: 'conc-001', priceKey: 'concrete_m3', note: 'Plus 5%' },
    { key: 'reo', name: 'Footing trench mesh', trade: 'Concreter', unit: 'LM', qty: r2(lengthM * Math.max(1, f.barsPerRun) * 1.05), rateId: '', priceKey: 'trenchmesh_lm',
      note: `${Math.max(1, f.barsPerRun)} run${f.barsPerRun > 1 ? 's' : ''}, 5% laps` },
  ];
}

export function trenchLines(lengthM: number, t: TrenchSpec): ConcreteLine[] {
  if (!(lengthM > 0)) return [];
  const dig = lengthM * (t.widthMm / 1000) * (t.depthMm / 1000);
  const bedding = lengthM * (t.widthMm / 1000) * (Math.min(t.beddingMm, t.depthMm) / 1000);
  const backfill = Math.max(0, dig - bedding);
  // What comes out swells; the bedding sand displaces that much, which has to go
  const spoilOut = bedding * BULKING[t.soil];
  const loads = spoilOut > 0 ? Math.ceil(spoilOut / (t.truckM3 || 10)) : 0;
  const lines: ConcreteLine[] = [
    { key: 'dig', name: 'Trench excavation', trade: 'Excavation', unit: 'M3', qty: r2(dig), rateId: 'site-001', priceKey: 'excavation_m3',
      note: `${t.widthMm} wide x ${t.depthMm} deep, ${r2(dig * BULKING[t.soil])} m³ once dug (${t.soil}). If your rate includes cart-away, leave spoil removal at $0` },
  ];
  if (bedding > 0) {
    lines.push({ key: 'bedding', name: 'Bedding sand', trade: 'Excavation', unit: 'M3', qty: r2(bedding * 1.1), rateId: '', priceKey: 'bedding_m3',
      note: `${t.beddingMm} mm under the pipe, plus 10% compaction` });
  }
  lines.push({ key: 'backfill', name: 'Backfill and compact', trade: 'Excavation', unit: 'M3', qty: r2(backfill), rateId: '', priceKey: 'backfill_m3',
    note: 'Dug material back in, compacted in layers' });
  if (loads > 0) {
    lines.push({ key: 'spoil', name: 'Spoil removal', trade: 'Excavation', unit: 'EA', qty: loads, rateId: '', priceKey: 'spoil_load', fixed: true,
      note: `${r2(spoilOut)} m³ surplus once dug, ${t.truckM3 || 10} m³ truck loads` });
  }
  return lines;
}

/** Real perimeter of a drawn area: outline length in drawing units scaled like the area. */
export function perimeterOf(m: { type?: string; worldPoints?: { x: number; y: number }[]; worldValue?: number; realValue?: number }): number {
  const pts = m.worldPoints ?? [];
  if (!m.worldValue || !m.realValue || pts.length < 2) return 0;
  const scale = Math.sqrt(m.realValue / m.worldValue);
  let world = 0;
  if (m.type === 'rectangle' && pts.length === 2) {
    world = 2 * (Math.abs(pts[1].x - pts[0].x) + Math.abs(pts[1].y - pts[0].y));
  } else if (m.type === 'circle' && pts.length >= 2) {
    world = 2 * Math.PI * Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  } else {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      world += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return r2(world * scale);
}
