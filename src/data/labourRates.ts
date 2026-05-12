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

const CUSTOM_RATES_KEY = "user_labour_rates";

export interface CustomRates {
  [trade: string]: number;
}

export function getCustomRates(): CustomRates {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_RATES_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setCustomRate(trade: string, rate: number) {
  const rates = getCustomRates();
  rates[trade] = rate;
  localStorage.setItem(CUSTOM_RATES_KEY, JSON.stringify(rates));
}

export function clearCustomRate(trade: string) {
  const rates = getCustomRates();
  delete rates[trade];
  localStorage.setItem(CUSTOM_RATES_KEY, JSON.stringify(rates));
}

export function getEffectiveRate(trade: string, state = "QLD"): number {
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
