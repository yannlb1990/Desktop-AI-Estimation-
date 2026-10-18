import { getUserStorageKey } from '@/lib/localAuth';

export interface LabourTrade {
  trade: string;
  icon: string;
  category: string;
  award: number;
  low: number;
  typical: number;
  high: number;
  desc: string;
}

export const LABOUR_MULT: Record<string, number> = {
  NSW: 1.00, VIC: 0.98, QLD: 0.96, WA: 1.12, SA: 0.93,
  TAS: 0.91, NT: 1.05, ACT: 1.03,
};

export const LABOUR_RATES: LabourTrade[] = [
  { trade: "Carpenter",          icon: "🔨", category: "Structural", award: 42, low: 75,  typical: 92,  high: 115, desc: "Framing, fix-out, formwork, joinery" },
  { trade: "Plumber",            icon: "🔧", category: "Services",   award: 44, low: 85,  typical: 105, high: 130, desc: "Sanitary, stormwater, hot/cold water" },
  { trade: "Electrician",        icon: "⚡", category: "Services",   award: 44, low: 88,  typical: 108, high: 135, desc: "Rough-in, fit-off, switchboard" },
  { trade: "Bricklayer",         icon: "🧱", category: "Structural", award: 41, low: 72,  typical: 88,  high: 110, desc: "Brick & block laying, mortar, DPC" },
  { trade: "Plasterer",          icon: "🏠", category: "Lining",     award: 40, low: 68,  typical: 84,  high: 105, desc: "Plasterboard fix, set, cornice, render" },
  { trade: "Painter",            icon: "🎨", category: "Finishing",  award: 38, low: 60,  typical: 76,  high: 95,  desc: "Interior / exterior paint, preparation" },
  { trade: "Tiler",              icon: "⬛", category: "Finishing",  award: 40, low: 70,  typical: 88,  high: 115, desc: "Floor & wall tiles, waterproofing prep" },
  { trade: "Concreter",          icon: "🏗️", category: "Structural", award: 41, low: 72,  typical: 88,  high: 108, desc: "Footings, slabs, paths, driveways" },
  { trade: "Roofer",             icon: "🏘️", category: "Structural", award: 42, low: 75,  typical: 95,  high: 120, desc: "Metal roofing, tiling, gutters, flashings" },
  { trade: "Waterproofer",       icon: "💧", category: "Finishing",  award: 40, low: 72,  typical: 90,  high: 115, desc: "Wet areas, balconies, below-ground tanking" },
  { trade: "Landscaper",         icon: "🌿", category: "External",   award: 36, low: 55,  typical: 72,  high: 95,  desc: "Retaining walls, turf, soft & hard landscape" },
  { trade: "Scaffolder",         icon: "🔗", category: "Structural", award: 43, low: 80,  typical: 98,  high: 125, desc: "Tube & coupler, system scaffold, edge protection" },
  { trade: "Steel Fixer",        icon: "⚙️", category: "Structural", award: 44, low: 82,  typical: 102, high: 128, desc: "Rebar cutting, bending & tying" },
  { trade: "Civil / Excavation", icon: "🚜", category: "Civil",      award: 38, low: 65,  typical: 82,  high: 110, desc: "Bulk earthworks, trenching, compaction" },
  { trade: "Demolition",         icon: "🔩", category: "Structural", award: 38, low: 65,  typical: 80,  high: 105, desc: "Strip out, saw cutting, slab removal" },
  { trade: "Glazier",            icon: "🪟", category: "Finishing",  award: 40, low: 72,  typical: 92,  high: 118, desc: "Windows, glass, frameless shower screens" },
  { trade: "General Labour",     icon: "👷", category: "Structural", award: 33, low: 45,  typical: 58,  high: 75,  desc: "Site labour, labouring, clean-up" },
];

const CUSTOM_RATES_BASE_KEY = 'user_labour_rates';
const customRatesKey = () => getUserStorageKey(CUSTOM_RATES_BASE_KEY);

export interface CustomRates {
  [trade: string]: number;
}

export function getCustomRates(): CustomRates {
  try {
    return JSON.parse(localStorage.getItem(customRatesKey()) || '{}');
  } catch {
    return {};
  }
}

export function setCustomRate(trade: string, rate: number) {
  const rates = getCustomRates();
  rates[trade] = rate;
  localStorage.setItem(customRatesKey(), JSON.stringify(rates));
}

export function clearCustomRate(trade: string) {
  const rates = getCustomRates();
  delete rates[trade];
  localStorage.setItem(customRatesKey(), JSON.stringify(rates));
}

const KNOWN_TRADES = [
  'Carpenter', 'Plumber', 'Electrician', 'Bricklayer', 'Plasterer', 'Painter', 'Tiler',
  'Concreter', 'Roofer', 'Landscaper', 'Waterproofer', 'Glazier', 'Renderer', 'Cabinetmaker',
  'Insulation Installer', 'Gutter Installer', 'Excavator Operator', 'Steel Fixer',
  'Scaffolder', 'HVAC Technician', 'General Labourer', 'Demolition',
];

/**
 * Match a name typed in Settings to the trade it means: ignores case and stray
 * spaces ("Plumber " = Plumber) and accepts close forms ("Concrete" = Concreter,
 * "Labourer" = General Labourer). Unknown names are kept as typed.
 */
/** The labour-rate trade a name stands for, or null when it isn't one (e.g. 'General', 'Concrete works'). */
export function knownTradeName(name: string | null | undefined): string | null {
  if (!name || /^general$/i.test(name.trim())) return null;
  const c = canonicalTradeName(name);
  const all = new Set([...KNOWN_TRADES, ...LABOUR_RATES.map(r => r.trade)]);
  return all.has(c) ? c : null;
}

export function canonicalTradeName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!n) return '';
  const all = [...new Set([...KNOWN_TRADES, ...LABOUR_RATES.map(r => r.trade)])];
  const exact = all.find(t => t.toLowerCase() === n);
  if (exact) return exact;
  const close = all.find(t => {
    const tl = t.toLowerCase();
    return tl.startsWith(n) || n.startsWith(tl) || tl.endsWith(' ' + n);
  });
  return close ?? name.trim();
}

/** Rates set in Settings → Rates (labour presets), by trade name. */
export function getSettingsPresetRates(): Record<string, number> {
  try {
    const presets: { name?: string; rate?: string | number }[] =
      JSON.parse(localStorage.getItem(getUserStorageKey('labour_presets')) || '[]');
    const out: Record<string, number> = {};
    presets.forEach(p => {
      const r = Number(p.rate);
      const trade = p.name ? canonicalTradeName(p.name) : '';
      if (trade && r > 0) out[trade] = r;
    });
    return out;
  } catch {
    return {};
  }
}

/** Market typical $/hr for every trade in a state (national typical × state factor). */
export function marketLabourRatesForState(state: string): Record<string, number> {
  const mult = LABOUR_MULT[state] ?? 1;
  const out: Record<string, number> = {};
  LABOUR_RATES.forEach(r => { out[r.trade] = Math.round(r.typical * mult); });
  return out;
}

/**
 * The same rule the Estimate uses: your Settings rate, else your "Save as profile
 * default" rate, else market typical for the state.
 */
export function getEffectiveRate(trade: string, state = "QLD"): number {
  const preset = getSettingsPresetRates()[trade];
  if (preset) return preset;
  const custom = getCustomRates()[trade];
  if (custom) return custom;
  const mult = LABOUR_MULT[state] ?? 1;
  const ref = LABOUR_RATES.find(r => r.trade === trade);
  return ref ? Math.round(ref.typical * mult) : 65;
}

export function findLabourRate(trade: string): LabourTrade | undefined {
  if (!trade) return undefined;
  const t = trade.toLowerCase();
  return LABOUR_RATES.find(r =>
    r.trade.toLowerCase() === t ||
    r.trade.toLowerCase().includes(t) ||
    t.includes(r.trade.toLowerCase().split(" ")[0].toLowerCase())
  );
}
