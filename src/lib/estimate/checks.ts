import { priceLine, type PricingConfig } from '@/lib/pricing/estimatePricing';
import { isMeasurementValueLabel } from '@/lib/takeoff/scopeLabels';

/**
 * Things to look at before a quote goes out: lines that cost nothing, scopes never
 * chosen, unfinished descriptions, measurements that look like stray clicks and labour
 * far outside normal. Each finding points at one estimate line.
 */
export interface EstimateCheck {
  itemId: string;
  /** 'fix' = the quote is wrong as it stands; 'check' = unusual, worth a second look */
  level: 'fix' | 'check';
  message: string;
}

export interface CheckableItem {
  id: string;
  trade: string;
  scope_of_work?: string | null;
  material_type?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  labour_hours: number;
  labour_rate?: number;
  labour_rate_override?: boolean;
  markup_pct?: number | null;
  plan_link?: { measurementIds: string[]; broken?: boolean } | null;
}

const unitKind = (unit: string | null | undefined): 'area' | 'length' | 'volume' | 'count' | 'other' => {
  const u = String(unit ?? '').toLowerCase().replace('²', '2').replace('³', '3').trim();
  if (['m2', 'sqm'].includes(u)) return 'area';
  if (['lm', 'm', 'lin m'].includes(u)) return 'length';
  if (['m3'].includes(u)) return 'volume';
  if (['ea', 'each', 'no', 'nr', 'item', 'items', 'count'].includes(u)) return 'count';
  return 'other';
};

/** Hours per unit above which a line is almost certainly a typo (generous on purpose). */
const MAX_HOURS_PER_UNIT = { area: 3, length: 3, volume: 10, count: 24, other: Infinity };
/** Plan quantities this small are usually an accidental click on the drawing. */
const TINY_QTY = { area: 0.5, length: 0.3, volume: 0.02, count: 0, other: 0 };

const UNIT_WORDS = /^(lineal|linear|lm|m|m2|m²|m3|m³|sqm|each|ea|qty|item|items|area|length|size|-)$/i;
/** Real short material names; anything else of 3 letters or fewer is usually a typo. */
const SHORT_MATERIALS = new Set(['pb', 'fc', 'cfc', 'mdf', 'osb', 'pvc', 'lvl', 'ply', 'hmr', 'mr', 'abs', 'pex', 'cu', 'gal', 'zinc', 'gyp', 'hdf', 'pir', 'xps', 'eps', 'upvc', 'hdpe', 'csk', 'ss', 'ms', 'gi', 'tile', 'sand', 'reo', 'mesh', 'tbc']);
/** Scopes that only name what was measured or a placeholder, never the work. */
const PLACEHOLDER_SCOPE = /^(wall|walls|floor|floors|ceiling|ceilings|measured length|measured area|counted items|custom item|item|line|rectangle|polygon|circle|count|other|general)( - .*)?$/i;
const isPlaceholderScope = (scope: string | null | undefined) => {
  const s = String(scope ?? '').trim();
  return !s || isMeasurementValueLabel(s) || PLACEHOLDER_SCOPE.test(s);
};
/** Lines that are meant to be $0 on a quote */
const DELIBERATE_ZERO = /owner supplied|supplied by owner|by owner|by others|excluded|exclusion|not included|n\/a|provisional|allowance tbc/i;
/** Units for lump sums, where hours per unit says nothing */
const LUMP_UNITS = /^(item|items|lot|ls|lump sum|job|allow|allowance)$/i;

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
const unitText = (u: string | null | undefined) => {
  const k = String(u ?? '').toUpperCase();
  return k === 'M2' ? 'm²' : k === 'M3' ? 'm³' : k === 'LM' ? 'lm' : k === 'EA' ? 'ea' : String(u ?? '');
};

export function checkEstimate(
  items: CheckableItem[],
  config: PricingConfig,
  labourRates: Record<string, number>,
): EstimateCheck[] {
  const out: EstimateCheck[] = [];
  for (const item of items) {
    const add = (level: EstimateCheck['level'], message: string) => out.push({ itemId: item.id, level, message });
    const qty = Number(item.quantity) || 0;
    const hours = Number(item.labour_hours) || 0;
    const kind = unitKind(item.unit);
    const line = priceLine(item as any, config, labourRates);

    if (item.plan_link?.broken) add('fix', 'The measurement this line followed was deleted');
    if (Math.abs(line.total) < 0.005) {
      const text = `${item.scope_of_work ?? ''} ${item.material_type ?? ''}`;
      if (DELIBERATE_ZERO.test(text)) add('check', 'Shows as $0 on the quote: fine if it is owner supplied or excluded');
      else add('fix', 'No price: this line adds $0 to the quote');
    }
    else if (qty <= 0 && hours <= 0) add('fix', 'Quantity is 0');

    if (isPlaceholderScope(item.scope_of_work)) add('fix', 'Scope of work not chosen');

    const material = String(item.material_type ?? '').trim();
    const unfinished = UNIT_WORDS.test(material) ||
      (material.length <= 3 && !/\d/.test(material) && !SHORT_MATERIALS.has(material.toLowerCase()));
    if (material && unfinished) {
      add('fix', `Material "${material}" looks unfinished and would print on the quote`);
    }

    if (item.plan_link?.measurementIds?.length && qty > 0 && qty < TINY_QTY[kind]) {
      add('check', `Only ${fmt(qty)} ${unitText(item.unit)} measured: possibly a stray click on the plan`);
    }

    // Only large blocks of time on a measured quantity: small or lump-sum lines can take long per unit
    if (qty > 1 && hours > 16 && !LUMP_UNITS.test(String(item.unit ?? '').trim()) && hours / qty > MAX_HOURS_PER_UNIT[kind]) {
      add('check', `${fmt(hours)} h for ${fmt(qty)} ${unitText(item.unit)} is ${fmt(hours / qty)} h per ${unitText(item.unit)}: check the hours`);
    }
  }
  return out;
}
