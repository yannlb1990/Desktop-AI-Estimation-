/**
 * Converts AI plan-analyser line items into Estimate tab line items without
 * changing their price.
 *
 * The analyser prices each line as an installed rate already split into
 * materialCost and labourCost (labourHours is the line's total hours). The old
 * conversion put the all-in rate into unit_price (materials) and then added
 * labour at $90/hr, 10%/5% waste and 20% markup on top, so accepting an AI
 * estimate roughly doubled it.
 */
import type { EstimatedLineItem } from '@/lib/aiPlanAnalyzer';

const UNIT_MAP: Record<string, string> = {
  lm: 'lm', m: 'lm',
  m2: 'm²', 'm²': 'm²',
  m3: 'm³', 'm³': 'm³',
  each: 'ea', ea: 'ea', count: 'ea', no: 'ea', nr: 'ea',
  item: 'item', lot: 'lot', ls: 'lot',
  hr: 'hr', hrs: 'hr', hour: 'hr',
  kg: 'kg', t: 't', l: 'L',
};

export function normaliseUnit(unit: string | undefined): string {
  if (!unit) return 'ea';
  return UNIT_MAP[unit.trim().toLowerCase()] ?? unit;
}

// Description keywords win over the analyser's category, which is a scope, not a trade.
const TRADE_BY_KEYWORD: [RegExp, string][] = [
  [/waterproof/i, 'Waterproofer'],
  [/\btil(e|es|ing)\b/i, 'Tiler'],
  [/insulation|batts/i, 'Insulation Installer'],
  [/render/i, 'Renderer'],
  [/glass|glaz|window|shower screen/i, 'Glazier'],
  [/gutter|downpipe|fascia/i, 'Gutter Installer'],
  [/carpet/i, 'Floor Coverings'],
];

const TRADE_BY_CATEGORY: Record<string, string> = {
  Preliminaries: 'Preliminaries',
  'Site Works': 'Excavator Operator',
  Concrete: 'Concreter',
  Carpentry: 'Carpenter',
  Brickwork: 'Bricklayer',
  Rendering: 'Renderer',
  Roofing: 'Roofer',
  'Windows & Doors': 'Carpenter',
  Plasterboard: 'Plasterer',
  Joinery: 'Cabinetmaker',
  Electrical: 'Electrician',
  Plumbing: 'Plumber',
  HVAC: 'HVAC Technician',
  Painting: 'Painter',
  'Floor Coverings': 'Carpenter',
  'External Works': 'Landscaper',
  Certifications: 'Certifications',
  Insulation: 'Insulation Installer',
  Tiling: 'Tiler',
  Waterproofing: 'Waterproofer',
  'Structural Steel': 'Steel Fixer',
};

export function tradeForAiItem(item: Pick<EstimatedLineItem, 'trade' | 'description'>): string {
  for (const [pattern, trade] of TRADE_BY_KEYWORD) {
    if (pattern.test(item.description || '')) return trade;
  }
  return TRADE_BY_CATEGORY[item.trade as string] || 'General Labourer';
}

/** Em-dashes read as AI-written; keep them out of anything a client sees. */
export function stripEmDashes(text: string): string {
  return text
    .replace(/\(([^)]*?)\s*[—–]\s*([^)]*)\)/g, '($1, $2)')
    .replace(/\s*[—–]\s*/g, ': ');
}

export function aiItemToEstimateItem(item: EstimatedLineItem, index: number) {
  const quantity = item.quantity || 0;
  const materialCost = item.materialCost || 0;
  const labourCost = item.labourCost || 0;
  const labourHours = item.labourHours || 0;

  // Labour priced at the analyser's own rate so hours x rate = labourCost exactly.
  // A labour cost with no hours (fees, lump sums) becomes 1 hour at that cost.
  const hours = labourHours > 0 ? labourHours : (labourCost > 0 ? 1 : 0);
  const rate = hours > 0 ? labourCost / hours : 0;

  return {
    id: item.id,
    section_id: null,
    area: item.area || 'General',
    trade: tradeForAiItem(item),
    scope_of_work: item.category || 'General',
    material_type: stripEmDashes(item.description || ''),
    quantity,
    unit: normaliseUnit(item.unit),
    unit_price: quantity > 0 ? materialCost / quantity : 0,
    labour_hours: hours,
    labour_rate: rate,
    labour_rate_override: hours > 0,
    // Analyser rates are installed rates: waste and markup are already in them.
    // Overheads and margin are applied once, at project level.
    material_wastage_pct: 0,
    labour_wastage_pct: 0,
    markup_pct: 0,
    notes: '',
    expanded: false,
    item_number: String(index + 1),
    isEditing: false,
    relatedMaterials: [],
  };
}

export function aiItemsToEstimateItems(items: EstimatedLineItem[]) {
  return items.map(aiItemToEstimateItem);
}
