import { SCOPE_OF_WORK_RATES, type AustralianState } from '@/data/scopeOfWorkRates';
import type { CostItem } from '@/lib/takeoff/types';
import type { AnalysisTrade } from '@/hooks/useAIPlanAnalysis';

export interface ResolvedRate {
  rate: number;
  rateSource: string;
  rateId: string;
}

/** Maps trade/category keywords (lowercased) to rate IDs in scopeOfWorkRates */
const TRADE_RATE_MAP: { keywords: string[]; unit: string; rateId: string }[] = [
  { keywords: ['wall framing', 'stud wall', 'framing lm', 'framing linear', 'wall frame lm'], unit: 'lm', rateId: 'carp-001' },
  { keywords: ['wall framing m', 'framing m2', 'framing m²', 'wall frame m'], unit: 'm²', rateId: 'carp-011' },
  { keywords: ['roof framing truss', 'truss roof', 'roof truss'], unit: 'm²', rateId: 'carp-003' },
  { keywords: ['roof framing conventional', 'conventional roof', 'rafter roof', 'timber roof'], unit: 'm²', rateId: 'carp-002' },
  { keywords: ['floor frame', 'floor framing', 'floor structure'], unit: 'm²', rateId: 'carp-004' },
  { keywords: ['door hang internal', 'internal door', 'passage door'], unit: 'ea', rateId: 'carp-006' },
  { keywords: ['door hang external', 'external door', 'entry door', 'front door'], unit: 'ea', rateId: 'carp-007' },
  { keywords: ['window install', 'window frame', 'window'], unit: 'ea', rateId: 'carp-008' },
  { keywords: ['skirting', 'architrave', 'timber trim', 'skirt'], unit: 'lm', rateId: 'carp-009' },
  { keywords: ['cornice', 'ceiling cornice'], unit: 'lm', rateId: 'carp-010' },
  { keywords: ['power point', 'gpo', 'electrical point', 'power outlet'], unit: 'ea', rateId: 'elec-001' },
  { keywords: ['data point', 'data outlet', 'ethernet point'], unit: 'ea', rateId: 'elec-002' },
  { keywords: ['light point', 'light fixture', 'downlight', 'lighting point'], unit: 'ea', rateId: 'elec-003' },
  { keywords: ['electrical rough-in', 'electrical rough in', 'electrical first fix'], unit: 'm²', rateId: 'elec-010' },
  { keywords: ['switchboard', 'msp', 'main switchboard'], unit: 'ea', rateId: 'elec-004' },
  { keywords: ['plumbing rough-in', 'plumbing rough in', 'plumbing first fix'], unit: 'ea', rateId: 'plum-001' },
  { keywords: ['toilet supply', 'wc supply', 'toilet installation'], unit: 'ea', rateId: 'plum-002' },
  { keywords: ['basin supply', 'hand basin', 'vanity supply'], unit: 'ea', rateId: 'plum-003' },
  { keywords: ['shower supply', 'shower install'], unit: 'ea', rateId: 'plum-004' },
  { keywords: ['bath supply', 'bath install', 'bathtub'], unit: 'ea', rateId: 'plum-005' },
  { keywords: ['plumbing per m2', 'plumbing m²', 'plumbing area'], unit: 'm²', rateId: 'plum-010' },
  { keywords: ['concrete slab', 'slab pour', 'concrete floor slab', 'slab concrete'], unit: 'm²', rateId: 'conc-001' },
  { keywords: ['footing', 'strip footing', 'pad footing', 'foundation'], unit: 'lm', rateId: 'conc-003' },
  { keywords: ['concrete m3', 'concrete cubic', 'concrete volume'], unit: 'm³', rateId: 'conc-002' },
  { keywords: ['plasterboard', 'plaster board', 'gyprock', 'drywall', 'lining', 'plaster m²'], unit: 'm²', rateId: 'plstr-001' },
  { keywords: ['ceiling lining', 'ceiling plaster', 'ceiling board'], unit: 'm²', rateId: 'plstr-002' },
  { keywords: ['internal paint', 'painting internal', 'paint m²', 'interior paint'], unit: 'm²', rateId: 'paint-001' },
  { keywords: ['external paint', 'exterior paint', 'painting external', 'cladding paint'], unit: 'm²', rateId: 'paint-002' },
  { keywords: ['roof tile', 'tiled roof', 'concrete tile', 'terracotta tile roof'], unit: 'm²', rateId: 'roof-001' },
  { keywords: ['colorbond', 'metal roof', 'corrugated roof', 'steel roof'], unit: 'm²', rateId: 'roof-002' },
  { keywords: ['roofing', 'roof cover'], unit: 'm²', rateId: 'roof-001' },
  { keywords: ['floor tile', 'ceramic tile', 'porcelain tile', 'tiling m²', 'floor tiling'], unit: 'm²', rateId: 'tile-001' },
  { keywords: ['wall tile', 'wall tiling'], unit: 'm²', rateId: 'tile-002' },
  { keywords: ['waterproofing wet area', 'wet area membrane', 'bathroom waterproof', 'shower waterproof'], unit: 'm²', rateId: 'wproof-001' },
  { keywords: ['external waterproof', 'deck waterproof', 'balcony waterproof'], unit: 'm²', rateId: 'wproof-002' },
  { keywords: ['insulation wall', 'wall insulation', 'bulk insulation wall'], unit: 'm²', rateId: 'insul-001' },
  { keywords: ['insulation ceiling', 'ceiling insulation', 'bulk insulation ceiling'], unit: 'm²', rateId: 'insul-002' },
  { keywords: ['carpet', 'floor carpet', 'carpet install'], unit: 'm²', rateId: 'floor-001' },
  { keywords: ['timber floor', 'floating floor', 'hybrid floor', 'laminate floor'], unit: 'm²', rateId: 'floor-002' },
  { keywords: ['kitchen', 'joinery kitchen', 'cabinetry kitchen', 'kitchen joinery'], unit: 'lsum', rateId: 'join-001' },
  { keywords: ['vanity', 'bathroom vanity', 'bathroom cabinet', 'vanity unit'], unit: 'ea', rateId: 'join-002' },
  { keywords: ['air conditioning', 'hvac', 'split system', 'ducted air'], unit: 'ea', rateId: 'hvac-001' },
  { keywords: ['site work', 'excavation', 'earthwork', 'cut fill'], unit: 'm³', rateId: 'site-001' },
];

export function resolveRate(
  tradeDescription: string,
  unit: string,
  state: AustralianState
): ResolvedRate {
  const needle = (tradeDescription + ' ' + unit).toLowerCase();

  for (const mapping of TRADE_RATE_MAP) {
    const unitMatch = !unit || unit.toLowerCase() === mapping.unit.toLowerCase() ||
      unit.toLowerCase().replace('²', '2') === mapping.unit.toLowerCase().replace('²', '2');
    const keywordMatch = mapping.keywords.some((kw) => needle.includes(kw));

    if (keywordMatch && unitMatch) {
      const rateEntry = SCOPE_OF_WORK_RATES.find((r) => r.id === mapping.rateId);
      if (rateEntry) {
        const rate = (rateEntry as any)[state] ?? rateEntry.QLD;
        return { rate, rateSource: `${state} rates — ${rateEntry.sow}`, rateId: rateEntry.id };
      }
    }
  }

  // Fuzzy fallback — match by trade category name only
  for (const mapping of TRADE_RATE_MAP) {
    const keywordMatch = mapping.keywords.some((kw) => needle.includes(kw.split(' ')[0]));
    if (keywordMatch) {
      const rateEntry = SCOPE_OF_WORK_RATES.find((r) => r.id === mapping.rateId);
      if (rateEntry) {
        const rate = (rateEntry as any)[state] ?? rateEntry.QLD;
        return { rate, rateSource: `${state} rates (approx) — ${rateEntry.sow}`, rateId: rateEntry.id };
      }
    }
  }

  return { rate: 0, rateSource: 'Rate not found — enter manually', rateId: '' };
}

/** Look up the rate for a known rateId + state (used when AI returns explicit rateId). */
export function lookupRate(rateId: string, state: AustralianState): number {
  const row = SCOPE_OF_WORK_RATES.find((r) => r.id === rateId);
  if (!row) return 0;
  return (row as Record<string, unknown>)[state] as number ?? 0;
}

/** Build CostItem[] from AI trade list, using explicit rateId first then keyword fallback. */
export function buildCostItemsFromTrades(
  trades: AnalysisTrade[],
  state: AustralianState
): Partial<CostItem>[] {
  return trades.map((t) => {
    let rate = 0;
    if (t.rateId) {
      rate = lookupRate(t.rateId, state);
    }
    if (rate === 0) {
      // Keyword fallback in case AI returned an unknown or missing rateId
      const resolved = resolveRate(t.trade + ' ' + t.unit, t.unit, state);
      rate = resolved.rate;
    }
    const total = rate > 0 ? Math.round(t.quantity * rate * 100) / 100 : 0;
    const conf = Math.round(t.confidence * 100);
    const notesPart = t.notes ? ` — ${t.notes}` : '';
    return {
      id: crypto.randomUUID(),
      trade: t.trade,
      description: `${t.trade}${notesPart} (AI ${conf}% confidence)`,
      quantity: t.quantity,
      unit: t.unit,
      rate,
      total,
    };
  });
}
