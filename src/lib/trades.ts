/**
 * The one list of trades, in build order. Every part of a job uses it: estimate, takeoff,
 * quote, claims, job cost, variations, quote requests and suppliers, so a trade's budget,
 * spending and claims always meet under the same name.
 *
 * Names are the work, not the person ("Plumbing", not "Plumber"). Older names and the
 * person names builders type are read as the trade they mean (normaliseTrade).
 */
export const TRADES = [
  'Preliminaries',
  'Demolition',
  'Site Works',
  'Concrete',
  'Termite Protection',
  'Structural Steel',
  'Carpentry',
  'Roofing',
  'Windows & Doors',
  'Brickwork',
  'Cladding',
  'Render',
  'Insulation',
  'Plasterboard',
  'Waterproofing',
  'Tiling',
  'Joinery',
  'Shower Screens & Mirrors',
  'Painting',
  'Floor Coverings',
  'Epoxy Flooring',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Fire Services',
  'Appliances',
  'Balustrades & Metalwork',
  'Garage Doors',
  'External Works',
  'Fencing',
  'Landscaping',
  'Scaffolding',
  'Crane / Lifting',
  'Waste & Cleaning',
  'Certifications',
  'General',
  'Other',
] as const;

export type TradeName = typeof TRADES[number];

/** Other names for each trade, lower case. */
const ALIASES: Record<string, TradeName> = {
  prelims: 'Preliminaries', preliminary: 'Preliminaries', 'site establishment': 'Preliminaries',
  demo: 'Demolition', 'strip out': 'Demolition', asbestos: 'Demolition',
  excavation: 'Site Works', excavator: 'Site Works', 'excavator operator': 'Site Works', earthworks: 'Site Works',
  civil: 'Site Works', 'civil / excavation': 'Site Works', 'site works': 'Site Works', 'site prep': 'Site Works',
  concreter: 'Concrete', concreting: 'Concrete', 'steel fixer': 'Concrete', reo: 'Concrete', formwork: 'Concrete', reinforcement: 'Concrete',
  termite: 'Termite Protection', 'pest control': 'Termite Protection',
  steel: 'Structural Steel', steelwork: 'Structural Steel', 'steel fabricator': 'Structural Steel', fabricator: 'Structural Steel',
  carpenter: 'Carpentry', carpenters: 'Carpentry', chippy: 'Carpentry', framing: 'Carpentry', framer: 'Carpentry', 'fix carpentry': 'Carpentry', 'fix out': 'Carpentry',
  roofer: 'Roofing', roof: 'Roofing', 'roof plumber': 'Roofing', 'gutter installer': 'Roofing', guttering: 'Roofing',
  glazier: 'Windows & Doors', glazing: 'Windows & Doors', windows: 'Windows & Doors', 'windows and doors': 'Windows & Doors', aluminium: 'Windows & Doors',
  bricklayer: 'Brickwork', brickie: 'Brickwork', bricklaying: 'Brickwork', blocklayer: 'Brickwork', masonry: 'Brickwork',
  'external cladding': 'Cladding', cladder: 'Cladding',
  renderer: 'Render', rendering: 'Render',
  'insulation installer': 'Insulation', insulator: 'Insulation',
  plasterer: 'Plasterboard', plaster: 'Plasterboard', plastering: 'Plasterboard', gyprock: 'Plasterboard', 'ceilings & partitions': 'Plasterboard', lining: 'Plasterboard',
  waterproofer: 'Waterproofing',
  tiler: 'Tiling', tiles: 'Tiling',
  joiner: 'Joinery', cabinetmaker: 'Joinery', 'cabinet maker': 'Joinery', cabinetry: 'Joinery', cabinets: 'Joinery', kitchens: 'Joinery', 'kitchen joinery': 'Joinery',
  'shower screens': 'Shower Screens & Mirrors', 'shower screen': 'Shower Screens & Mirrors', mirrors: 'Shower Screens & Mirrors',
  painter: 'Painting', paint: 'Painting',
  flooring: 'Floor Coverings', 'flooring installer': 'Floor Coverings', 'floor layer': 'Floor Coverings', carpet: 'Floor Coverings', 'timber flooring': 'Floor Coverings',
  epoxy: 'Epoxy Flooring',
  plumber: 'Plumbing', 'plumbing & drainage': 'Plumbing', drainer: 'Plumbing', drainage: 'Plumbing', gasfitter: 'Plumbing',
  electrician: 'Electrical', sparky: 'Electrical', sparkie: 'Electrical', electrical: 'Electrical', solar: 'Electrical', data: 'Electrical', security: 'Electrical',
  mechanical: 'HVAC', 'air conditioning': 'HVAC', aircon: 'HVAC', 'hvac technician': 'HVAC',
  fire: 'Fire Services', 'fire protection': 'Fire Services',
  appliance: 'Appliances',
  balustrade: 'Balustrades & Metalwork', balustrades: 'Balustrades & Metalwork', metalwork: 'Balustrades & Metalwork', handrails: 'Balustrades & Metalwork',
  'garage door': 'Garage Doors',
  driveway: 'External Works', driveways: 'External Works', paths: 'External Works', paving: 'External Works', 'driveway & paths': 'External Works',
  fencer: 'Fencing', fence: 'Fencing',
  landscaper: 'Landscaping', landscape: 'Landscaping', 'retaining walls': 'Landscaping',
  scaffolder: 'Scaffolding', scaffold: 'Scaffolding',
  crane: 'Crane / Lifting', 'crane hire': 'Crane / Lifting', lifting: 'Crane / Lifting',
  waste: 'Waste & Cleaning', 'skip bins': 'Waste & Cleaning', cleaning: 'Waste & Cleaning', cleaner: 'Waste & Cleaning', rubbish: 'Waste & Cleaning',
  certification: 'Certifications', certifier: 'Certifications', insurance: 'Certifications', 'home warranty': 'Certifications', engineer: 'Certifications', permits: 'Certifications',
  'general labour': 'General', 'general labourer': 'General', labourer: 'General', labour: 'General',
};

const byLower = new Map<string, TradeName>(TRADES.map(t => [t.toLowerCase(), t]));

/**
 * The trade a name means: "Plumber", "plumbing " and "Plumbing" are all Plumbing.
 * A name that isn't a known trade is kept as typed (a builder's own trade).
 */
export function normaliseTrade(name: string | null | undefined): string {
  const typed = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!typed) return '';
  const n = typed.toLowerCase();
  return byLower.get(n) ?? ALIASES[n] ?? ALIASES[n.replace(/s$/, '')] ?? typed;
}

export function isKnownTrade(name: string | null | undefined): boolean {
  return byLower.has(normaliseTrade(name).toLowerCase());
}

/** Known trades first in build order, then a builder's own trades A to Z. */
export function sortTrades(names: Iterable<string>): string[] {
  const set = new Set(names);
  return [
    ...TRADES.filter(t => set.has(t)),
    ...[...set].filter(t => !byLower.has(t.toLowerCase())).sort((a, b) => a.localeCompare(b)),
  ];
}

/** Adds amounts kept under different names for the same trade ("Carpenter" + "Carpentry"). */
export function sumByTrade(values: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(values || {})) {
    const t = normaliseTrade(k) || k;
    out[t] = Math.round(((out[t] || 0) + (Number(v) || 0)) * 100) / 100;
  }
  return out;
}

/** The labour-rate trade (the person doing it) whose hourly rate a trade's lines use. */
const LABOUR_TRADE: Partial<Record<TradeName, string>> = {
  'Demolition': 'Demolition',
  'Site Works': 'Civil / Excavation',
  'Concrete': 'Concreter',
  'Carpentry': 'Carpenter',
  'Roofing': 'Roofer',
  'Windows & Doors': 'Glazier',
  'Brickwork': 'Bricklayer',
  'Cladding': 'Carpenter',
  'Render': 'Plasterer',
  'Insulation': 'Carpenter',
  'Plasterboard': 'Plasterer',
  'Waterproofing': 'Waterproofer',
  'Tiling': 'Tiler',
  'Joinery': 'Carpenter',
  'Shower Screens & Mirrors': 'Glazier',
  'Painting': 'Painter',
  'Floor Coverings': 'Carpenter',
  'Plumbing': 'Plumber',
  'Electrical': 'Electrician',
  'Balustrades & Metalwork': 'Carpenter',
  'Fencing': 'Carpenter',
  'Landscaping': 'Landscaper',
  'Scaffolding': 'Scaffolder',
  'Waste & Cleaning': 'General Labour',
  'General': 'General Labour',
  'External Works': 'Concreter',
};

export function labourTradeFor(trade: string | null | undefined): string | undefined {
  return LABOUR_TRADE[normaliseTrade(trade) as TradeName];
}

/** An hourly rate for a trade from a map keyed by trade or by person ("Carpenter"). */
export function labourRateForTrade(trade: string | null | undefined, rates: Record<string, number>): number | undefined {
  if (!trade) return undefined;
  if (rates[trade]) return rates[trade];
  // only a line already under the trade's own name borrows the person's rate: an older line
  // ("Insulation Installer") keeps pricing exactly as before until it is renamed
  if (normaliseTrade(trade) !== trade.trim()) return undefined;
  const person = labourTradeFor(trade);
  return (person ? rates[person] : undefined) || undefined;
}
