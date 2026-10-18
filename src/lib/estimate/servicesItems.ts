/**
 * Services by point counts, the way Australian trades price them: electricians per
 * point, plumbers per fixture (rough-in and fit-off), air conditioning by room load.
 * Quantities and sizes are rule-of-thumb suggestions; the licensed trade designs the
 * install (AS/NZS 3000 wiring, AS/NZS 3500 plumbing, manufacturer sizing).
 */

export interface PointType {
  key: string;
  label: string;
  /** words that identify this point in a count marker's name on the plan */
  match: RegExp;
  /** names that look like a match but are something else (skylight, shower screen, gas cooktop) */
  exclude?: RegExp;
}

// Order matters: the first match wins, so specific names come before general ones.
// GPOs go first: Australian GPOs are switched, and "Outdoor GPO" or "Dishwasher GPO" is a power point.
export const ELECTRICAL_POINTS: PointType[] = [
  { key: 'gpo_single', label: 'Single power point', match: /\bsingle\b.*(gpo|power)|\bsgpo\b/i },
  { key: 'gpo_double', label: 'Double power point', match: /gpo|power\s*point/i },
  { key: 'smoke', label: 'Smoke alarm (hardwired, interconnected)', match: /smoke/i },
  { key: 'switch', label: 'Light switch', match: /switch/i, exclude: /switchboard/i },
  { key: 'outdoor', label: 'Outdoor light', match: /(outdoor|external|sensor|flood).*light|light.*(outdoor|external)/i },
  { key: 'fan', label: 'Exhaust fan', match: /exhaust|ceiling fan|\bfan\b/i, exclude: /fan\s*coil/i },
  { key: 'light', label: 'Light point (downlight or batten)', match: /down\s*light|light|\bdl\b|batten|pendant/i, exclude: /sky\s*light|high\s*light/i },
  { key: 'data', label: 'Data point', match: /data|cat6|network/i },
  { key: 'tv', label: 'TV point', match: /\btv\b|antenna/i },
  { key: 'oven', label: 'Oven circuit', match: /oven/i, exclude: /\bgas\b/i },
  { key: 'cooktop', label: 'Cooktop circuit', match: /cooktop|hob/i, exclude: /\bgas\b/i },
  { key: 'ac_circuit', label: 'Air conditioner circuit', match: /a\/?c\s*(circuit|isolator)|aircon/i },
  { key: 'hws_circuit', label: 'Hot water circuit', match: /hws|hot water/i, exclude: /\bgas\b/i },
];

/** Count markers that name a fixture but are a fitting, a cabinet or another trade's item */
const NOT_A_FIXTURE = /screen|holder|door|cabinet|window|light|heater|gpo|meter|rail|mirror|shelf|niche/i;

export const PLUMBING_FIXTURES: PointType[] = [
  { key: 'wc', label: 'Toilet', match: /\bwc\b|toilet/i, exclude: NOT_A_FIXTURE },
  { key: 'basin', label: 'Basin', match: /basin|vanity/i, exclude: NOT_A_FIXTURE },
  { key: 'shower', label: 'Shower', match: /shower/i, exclude: NOT_A_FIXTURE },
  { key: 'bath', label: 'Bath', match: /\bbath\b|bathtub/i, exclude: NOT_A_FIXTURE },
  { key: 'sink', label: 'Kitchen sink', match: /sink/i, exclude: NOT_A_FIXTURE },
  { key: 'tub', label: 'Laundry tub', match: /laundry|\btub\b|trough/i, exclude: NOT_A_FIXTURE },
  { key: 'washer', label: 'Washing machine taps and waste', match: /washing|\bwm\b/i, exclude: NOT_A_FIXTURE },
  { key: 'dishwasher', label: 'Dishwasher connection', match: /dishwasher|\bdw\b/i, exclude: NOT_A_FIXTURE },
  { key: 'tap', label: 'Garden tap', match: /garden tap|hose|ext(ernal)? tap/i, exclude: NOT_A_FIXTURE },
  { key: 'gas', label: 'Gas point', match: /\bgas\b/i, exclude: NOT_A_FIXTURE },
];

export interface ServiceLine {
  key: string;
  label: string;
  trade: 'Electrician' | 'Plumber' | 'HVAC Technician';
  unit: 'EA' | 'ITEM';
  qty: number;
  priceKey: string;
  note: string;
  /** count markers on the plan this quantity came from */
  measurementIds?: string[];
}

/** Count markers whose names match a point type, summed. */
export function countsFromPlan(
  types: PointType[],
  markers: { id: string; label?: string; comments?: string; unit?: string; realValue?: number }[],
): Record<string, { qty: number; ids: string[] }> {
  const out: Record<string, { qty: number; ids: string[] }> = {};
  for (const m of markers) {
    if (String(m.unit || '').toUpperCase() !== 'COUNT') continue;
    const text = `${m.label ?? ''} ${m.comments ?? ''}`;
    // First match wins, so "double power point" is not also a light or a switch
    const t = types.find(t => t.match.test(text) && !(t.exclude && t.exclude.test(text)));
    if (!t) continue;
    const cur = out[t.key] ?? { qty: 0, ids: [] };
    cur.qty += Number(m.realValue) || 0;
    cur.ids.push(m.id);
    out[t.key] = cur;
  }
  return out;
}

export interface ElectricalSuggestion {
  lightingCircuits: number;
  powerCircuits: number;
  dedicatedCircuits: number;
  rcbos: number;
  smokeAlarmsMin: number;
}

/**
 * Board size from the points: about 20 lights or 10 power points per circuit, one
 * circuit per fixed appliance, an RCBO on every final subcircuit (RCD protection on
 * all of them under AS/NZS 3000:2018). Smoke alarms: at least one per bedroom plus one
 * per storey (NCC: bedrooms, hallways serving them, every storey).
 */
export function suggestElectrical(qty: Record<string, number>, bedrooms: number, storeys: number): ElectricalSuggestion {
  const lights = (qty.light || 0) + (qty.outdoor || 0) + (qty.fan || 0);
  const power = (qty.gpo_double || 0) + (qty.gpo_single || 0);
  const lightingCircuits = lights > 0 ? Math.ceil(lights / 20) : 0;
  const powerCircuits = power > 0 ? Math.ceil(power / 10) : 0;
  const dedicatedCircuits = (qty.oven || 0) + (qty.cooktop || 0) + (qty.ac_circuit || 0) + (qty.hws_circuit || 0);
  return {
    lightingCircuits,
    powerCircuits,
    dedicatedCircuits,
    rcbos: lightingCircuits + powerCircuits + dedicatedCircuits,
    smokeAlarmsMin: Math.max(0, bedrooms) + Math.max(1, storeys),
  };
}

/** Storage hot water size for the household (retailer guide, rounded to common tank sizes). */
export function suggestHotWaterLitres(people: number): number {
  if (people <= 2) return 160;
  if (people <= 4) return 250;
  return 315;
}

export const SPLIT_SIZES_KW = [2.5, 3.5, 5.0, 6.0, 7.1, 8.0, 9.0];
export const DUCTED_SIZES_KW = [7.1, 8.0, 10.0, 12.5, 14.0, 16.0, 18.0, 20.0];

/** Cooling load per m² by room use (warm climate, normal 2.4 to 2.7 m ceilings) */
export const ROOM_WATTS_PER_M2: { match: RegExp; w: number }[] = [
  { match: /living|lounge|family|kitchen|dining|meals|rumpus|theatre/i, w: 140 },
  { match: /bed|master|study|office/i, w: 110 },
];
export const DEFAULT_W_PER_M2 = 125;

export const wattsFor = (room: string) => ROOM_WATTS_PER_M2.find(r => r.match.test(room))?.w ?? DEFAULT_W_PER_M2;
export const nextSize = (kw: number, sizes: number[]) => sizes.find(s => s >= kw - 1e-9) ?? sizes[sizes.length - 1];

export interface RoomLoad { name: string; m2: number; wPerM2: number; kw: number; splitKw: number; tooBig: boolean }

export function roomLoads(rooms: { name: string; m2: number; wPerM2?: number }[]): RoomLoad[] {
  return rooms.filter(r => r.m2 > 0).map(r => {
    const w = r.wPerM2 ?? wattsFor(r.name);
    const kw = Math.round((r.m2 * w) / 100) / 10;
    return { name: r.name, m2: r.m2, wPerM2: w, kw, splitKw: nextSize(kw, SPLIT_SIZES_KW), tooBig: kw > SPLIT_SIZES_KW[SPLIT_SIZES_KW.length - 1] };
  });
}

/** Ducted: rooms are not all at peak together, so about 80% of the summed load. */
export function ductedSize(loads: RoomLoad[]): { totalKw: number; unitKw: number; outlets: number; tooBig: boolean } {
  const total = loads.reduce((s, r) => s + r.kw, 0);
  return {
    tooBig: total * 0.8 > DUCTED_SIZES_KW[DUCTED_SIZES_KW.length - 1],
    totalKw: Math.round(total * 10) / 10,
    unitKw: nextSize(total * 0.8, DUCTED_SIZES_KW),
    outlets: loads.reduce((s, r) => s + (r.m2 > 25 ? 2 : 1), 0),
  };
}

/** Rooms that normally get no air conditioning */
export const NOT_CONDITIONED = /bath|ensuite|\bwc\b|toilet|laundry|garage|patio|balcony|external|outdoor|alfresco|deck|porch|storage|store|hall|entry|stair|pantry|robe|plant|site/i;
