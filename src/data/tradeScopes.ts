import type { TradeName } from '@/lib/trades';
import { normaliseTrade } from '@/lib/trades';

export type ScopeUnit = 'm²' | 'lm' | 'm³' | 'ea' | 'item';

/** A prime cost item (a fixture or fitting the client picks) or a provisional sum (work whose cost isn't known yet). */
export type Allowance = 'PC' | 'PS';

export interface TradeScope {
  /** the scope of work as it reads on the estimate and quote */
  name: string;
  unit: ScopeUnit;
  /**
   * Typical supply and install price per unit, ex GST, for NSW in 2026: a starting point to
   * check against your own subbies' prices, adjusted by state (scopeRate).
   */
  rate: number;
  allowance?: Allowance;
}

const s = (name: string, unit: ScopeUnit, rate: number, allowance?: Allowance): TradeScope => ({ name, unit, rate, allowance });

/** Scopes of work for each trade, roughly in the order they happen on site. */
export const TRADE_SCOPES: Record<TradeName, TradeScope[]> = {
  'Preliminaries': [
    s('Site establishment and amenities', 'item', 2500), s('Temporary fencing', 'lm', 18), s('Site toilet hire (per week)', 'ea', 95),
    s('Temporary power and water', 'item', 1800), s('Site supervision (per week)', 'ea', 1400), s('Set out and survey', 'item', 1800),
  ],
  'Demolition': [
    s('Strip out internal', 'm²', 45), s('Demolish wall (non load bearing)', 'm²', 55), s('Remove existing kitchen', 'item', 1200),
    s('Remove existing bathroom', 'item', 2200), s('Full house demolition', 'm²', 95), s('Asbestos removal (licensed)', 'm²', 65, 'PS'),
    s('Concrete breaking and removal', 'm²', 85),
  ],
  'Site Works': [
    s('Site clearing and scrape', 'm²', 9), s('Bulk excavation and cart away', 'm³', 85), s('Detailed excavation for footings', 'm³', 120),
    s('Fill and compaction', 'm³', 75), s('Rock excavation', 'm³', 280, 'PS'), s('Stormwater drainage', 'lm', 120), s('Sewer connection', 'item', 3500, 'PS'),
    s('Retaining wall (sleeper)', 'm²', 320),
  ],
  'Concrete': [
    s('Strip footings', 'm³', 520), s('Pad footings', 'ea', 450), s('Waffle pod slab', 'm²', 145), s('Raft slab', 'm²', 165),
    s('Garage slab', 'm²', 120), s('Bored piers', 'ea', 650, 'PS'), s('Driveway (plain)', 'm²', 95), s('Driveway (exposed aggregate)', 'm²', 130),
    s('Paths', 'm²', 90), s('Pump hire', 'item', 1100),
  ],
  'Termite Protection': [
    s('Termite protection, slab penetrations and perimeter', 'item', 1900), s('Termite barrier (perimeter)', 'lm', 38), s('Chemical treatment', 'item', 1400),
  ],
  'Structural Steel': [
    s('Steel beam supply and install', 'lm', 260), s('Steel post supply and install', 'ea', 480), s('Lintels', 'lm', 85), s('Galvanised portal frame', 'item', 4500, 'PS'),
  ],
  'Carpentry': [
    s('Wall framing', 'm²', 45), s('Roof trusses supply and install', 'm²', 55), s('Pitched roof framing (conventional)', 'm²', 75),
    s('Floor framing (bearers and joists)', 'm²', 85), s('Yellow tongue flooring', 'm²', 42), s('Hang internal door', 'ea', 320),
    s('Hang external door', 'ea', 650), s('Skirting', 'lm', 22), s('Architraves', 'lm', 20), s('Door hardware fit-off', 'ea', 95),
    s('Timber deck', 'm²', 420), s('Pergola', 'm²', 380), s('Timber stairs', 'ea', 6500), s('Fit off (cupboards, shelving, accessories)', 'item', 2500),
  ],
  'Roofing': [
    s('Colorbond roofing', 'm²', 75), s('Concrete roof tiles', 'm²', 70), s('Terracotta roof tiles', 'm²', 110), s('Sarking', 'm²', 9),
    s('Fascia and gutter', 'lm', 65), s('Downpipes', 'ea', 180), s('Ridge and flashings', 'lm', 45), s('Roof insulation blanket', 'm²', 14),
    s('Ridge and hip capping', 'lm', 38), s('Valley gutter', 'lm', 70), s('Barge flashing', 'lm', 42), s('Apron and wall flashing', 'lm', 48),
    s('Roof battens', 'm²', 14), s('Penetration flashing', 'ea', 160), s('Skylight supply and install', 'ea', 1400),
    s('Roof vent (whirlybird)', 'ea', 280), s('Remove existing roof', 'm²', 22),
  ],
  'Windows & Doors': [
    s('Aluminium window (standard)', 'ea', 850), s('Aluminium window (double glazed)', 'ea', 1350), s('Aluminium sliding door', 'ea', 2200),
    s('Stacker door', 'ea', 4800), s('Entry door supply', 'ea', 1800, 'PC'), s('Fly screens', 'ea', 120), s('Security screen door', 'ea', 750),
  ],
  'Brickwork': [
    s('Face brick veneer', 'm²', 110), s('Rendered brick or block', 'm²', 95), s('Blockwork', 'm²', 115), s('Brick supply allowance (per 1000)', 'ea', 1100, 'PC'),
    s('Brick piers', 'ea', 280), s('Brick letterbox', 'ea', 850),
  ],
  'Cladding': [
    s('Fibre cement weatherboards', 'm²', 95), s('Fibre cement sheet cladding', 'm²', 85), s('Timber cladding', 'm²', 150),
    s('Metal cladding', 'm²', 120), s('Wall wrap', 'm²', 8), s('Eaves lining', 'm²', 55),
  ],
  'Render': [
    s('Acrylic render on brick or block', 'm²', 70), s('Render on foam or fibre cement (system)', 'm²', 95), s('Paint finish on render', 'm²', 28),
  ],
  'Insulation': [
    s('Wall batts R2.5', 'm²', 18), s('Ceiling batts R4.0', 'm²', 20), s('Ceiling batts R6.0', 'm²', 26), s('Acoustic batts internal walls', 'm²', 22),
    s('Underfloor insulation', 'm²', 32),
  ],
  'Plasterboard': [
    s('Plasterboard walls supply, fix and set', 'm²', 42), s('Plasterboard ceilings supply, fix and set', 'm²', 48), s('Wet area board', 'm²', 52),
    s('Cornice 90mm', 'lm', 16), s('Square set ceilings', 'm²', 62), s('Bulkheads', 'lm', 95), s('Patch and repair', 'item', 650),
  ],
  'Waterproofing': [
    s('Shower base and walls (to AS 3740)', 'ea', 650), s('Wet area floor', 'm²', 65), s('Balcony membrane', 'm²', 110),
    s('Below ground tanking', 'm²', 145), s('Waterproofing certificate', 'ea', 120),
  ],
  'Tiling': [
    s('Floor tiling (lay only)', 'm²', 75), s('Wall tiling (lay only)', 'm²', 85), s('Tile supply allowance', 'm²', 55, 'PC'),
    s('Large format tiling (600 x 1200 or larger)', 'm²', 110), s('Kitchen splashback tiles', 'm²', 160), s('Screed and falls', 'm²', 45),
    s('Tile trims and silicone', 'item', 350), s('Feature niche', 'ea', 450),
  ],
  'Joinery': [
    s('Kitchen base cabinets', 'lm', 1100), s('Kitchen overhead cabinets', 'lm', 750), s('Kitchen island cabinets', 'lm', 1350),
    s('Pantry or oven tower', 'ea', 2400), s('Kitchen benchtop, natural stone', 'lm', 1500), s('Kitchen benchtop, porcelain or sintered', 'lm', 1300),
    s('Kitchen benchtop, laminate', 'lm', 380), s('Kitchen benchtop, timber', 'lm', 700), s('Stone waterfall end', 'ea', 1400),
    s('Glass or stone splashback', 'lm', 450), s('Sink and cooktop cut-outs', 'ea', 180), s('Soft close hardware and handles', 'item', 900),
    s('Vanity unit 600mm', 'ea', 1100), s('Vanity unit 900mm', 'ea', 1450), s('Vanity unit 1200mm', 'ea', 1850), s('Double vanity 1500mm', 'ea', 2400),
    s('Vanity top (stone or porcelain)', 'ea', 750), s('Laundry base cabinets', 'lm', 950), s('Laundry overhead cabinets', 'lm', 650),
    s('Laundry tall cupboard', 'ea', 1500), s('Laundry benchtop', 'lm', 450), s('Built-in robe (doors and fit-out)', 'lm', 950),
    s('Walk-in robe fit-out', 'lm', 650), s('Linen cupboard fit-out', 'ea', 1100), s('Study desk and shelving', 'lm', 900), s('Entertainment unit', 'lm', 1300),
  ],
  'Shower Screens & Mirrors': [
    s('Frameless shower screen', 'ea', 1500), s('Semi-frameless shower screen', 'ea', 900), s('Fixed shower panel', 'ea', 750),
    s('Mirror (polished edge)', 'ea', 280), s('Shaving cabinet', 'ea', 650, 'PC'),
  ],
  'Painting': [
    s('Interior walls 2 coats', 'm²', 30), s('Ceilings 2 coats', 'm²', 26), s('Doors and frames', 'ea', 160), s('Skirting and architraves', 'lm', 10),
    s('Exterior walls 2 coats', 'm²', 38), s('Eaves and fascia', 'lm', 22), s('Feature wall', 'm²', 40),
  ],
  'Floor Coverings': [
    s('Hybrid or laminate floating floor', 'm²', 95), s('Engineered timber floor', 'm²', 160), s('Solid timber floor, sand and finish', 'm²', 210),
    s('Carpet and underlay', 'm²', 75), s('Vinyl plank', 'm²', 80), s('Floor levelling', 'm²', 35), s('Floor coverings allowance', 'm²', 90, 'PC'),
  ],
  'Epoxy Flooring': [
    s('Epoxy floor coating', 'm²', 75), s('Polished concrete', 'm²', 95), s('Grind and seal', 'm²', 45),
  ],
  'Plumbing': [
    s('Drainage under slab', 'item', 4500), s('Rough-in per fixture point', 'ea', 650), s('Fit-off per fixture point', 'ea', 280),
    s('Toilet suite install', 'ea', 380), s('Toilet suite supply', 'ea', 650, 'PC'), s('Tapware supply', 'item', 1500, 'PC'),
    s('Basin or sink supply', 'ea', 350, 'PC'), s('Bath supply and install', 'ea', 1800), s('Hot water system (heat pump)', 'ea', 4200),
    s('Hot water system (gas)', 'ea', 2900), s('Gas line', 'lm', 95), s('Rainwater tank', 'ea', 3200), s('Stormwater connection', 'item', 2500, 'PS'),
    s('Dishwasher and fridge water connection', 'ea', 220), s('Floor waste', 'ea', 180),
  ],
  'Electrical': [
    s('Switchboard upgrade', 'ea', 1850), s('Rough-in per point', 'ea', 95), s('Power point (double)', 'ea', 150), s('LED downlight', 'ea', 140),
    s('Light point', 'ea', 125), s('Exhaust fan', 'ea', 300), s('Smoke alarm (hardwired, interconnected)', 'ea', 170), s('Oven and cooktop circuit', 'ea', 450),
    s('Data point', 'ea', 160), s('Ceiling fan', 'ea', 380), s('External lights', 'ea', 180), s('Solar system 6.6kW', 'ea', 6500),
    s('Light fittings allowance', 'item', 1500, 'PC'),
  ],
  'HVAC': [
    s('Split system up to 7kW', 'ea', 2300), s('Ducted reverse cycle', 'item', 14000), s('Bathroom heater and fan', 'ea', 450), s('Rangehood ducting', 'ea', 350),
  ],
  'Fire Services': [
    s('Fire hose reel', 'ea', 2800), s('Fire extinguisher', 'ea', 380), s('Fire separation wall', 'm²', 120), s('Fire rated door', 'ea', 1600),
  ],
  'Appliances': [
    s('Oven supply', 'ea', 1800, 'PC'), s('Cooktop supply', 'ea', 1200, 'PC'), s('Rangehood supply', 'ea', 900, 'PC'), s('Dishwasher supply', 'ea', 1100, 'PC'),
    s('Appliance package allowance', 'item', 5000, 'PC'), s('Appliance installation', 'ea', 180),
  ],
  'Balustrades & Metalwork': [
    s('Glass balustrade (frameless)', 'lm', 650), s('Aluminium balustrade', 'lm', 380), s('Stainless steel handrail', 'lm', 260), s('Steel stair stringers', 'ea', 3800),
  ],
  'Garage Doors': [
    s('Panel lift garage door (single)', 'ea', 2200), s('Panel lift garage door (double)', 'ea', 3300), s('Roller door', 'ea', 1800), s('Motor and remotes', 'ea', 750),
  ],
  'External Works': [
    s('Paving', 'm²', 120), s('Concrete paths', 'm²', 90), s('Clothesline', 'ea', 450), s('Letterbox', 'ea', 350), s('Garden shed', 'ea', 1800),
  ],
  'Fencing': [
    s('Colorbond fence 1.8m', 'lm', 110), s('Timber paling fence 1.8m', 'lm', 130), s('Pool fence (glass)', 'lm', 450), s('Gate', 'ea', 650),
  ],
  'Landscaping': [
    s('Turf supply and lay', 'm²', 28), s('Garden beds and planting', 'm²', 85), s('Mulch', 'm²', 18), s('Retaining wall (block)', 'm²', 380),
    s('Landscaping allowance', 'item', 5000, 'PS'),
  ],
  'Scaffolding': [
    s('Scaffold hire and erect', 'm²', 28), s('Edge protection', 'lm', 35), s('Scaffold hire (per week)', 'ea', 650),
  ],
  'Crane / Lifting': [
    s('Crane hire', 'item', 3500, 'PS'), s('Truss lift', 'item', 1200),
  ],
  'Waste & Cleaning': [
    s('Skip bin', 'ea', 650), s('Builders clean', 'item', 950), s('Final clean', 'item', 750), s('Rubbish removal', 'item', 1200),
  ],
  'Certifications': [
    s('Home warranty insurance (HBCF / QBCC)', 'item', 3500, 'PS'), s('Building certifier', 'item', 3800), s('Engineering', 'item', 2800),
    s('Energy rating / BASIX', 'item', 650), s('Contract works insurance', 'item', 1200), s('Soil test and contour survey', 'item', 1600),
    s('Council and authority fees', 'item', 2500, 'PS'),
  ],
  'General': [
    s('General labour', 'ea', 60), s('Contingency', 'item', 0, 'PS'),
  ],
  'Other': [],
};

/** State price levels against NSW (same scale as labour rates). */
const STATE_MULT: Record<string, number> = { NSW: 1.0, VIC: 0.98, QLD: 0.96, WA: 1.12, SA: 0.93, TAS: 0.91, NT: 1.05, ACT: 1.03 };

export function scopesForTrade(trade: string): TradeScope[] {
  return TRADE_SCOPES[normaliseTrade(trade) as TradeName] ?? [];
}

export function findScope(trade: string, name: string): TradeScope | undefined {
  const n = name.trim().toLowerCase();
  return scopesForTrade(trade).find(x => x.name.toLowerCase() === n);
}

/** A scope's typical price in a state, to the cent. */
export function scopeRate(scope: TradeScope, state?: string | null): number {
  return Math.round(scope.rate * (STATE_MULT[(state || 'NSW').toUpperCase()] ?? 1) * 100) / 100;
}
