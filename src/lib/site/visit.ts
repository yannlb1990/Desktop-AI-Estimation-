/**
 * Site visit: what a builder records walking a renovation on a phone (rooms, sizes,
 * photos, notes, a scope checklist), later turned into estimate lines on the desktop.
 */

export type QtyBasis = 'floor' | 'walls' | 'ceiling' | 'perimeter' | 'each';

export interface ScopeOption {
  key: string;
  label: string;
  trade: string;
  unit: 'm²' | 'lm' | 'ea' | 'item';
  qtyFrom: QtyBasis;
}

export interface SitePhoto {
  id: string;
  /** storage path once uploaded (site-photos/<uid>/<visit>/<id>.jpg) */
  path?: string;
  caption: string;
  takenAt: string;
}

/** Any other measurement taken in a room: "Deck subframe 5 lm", "Slab 1.2 m³", "Ceiling height 3.1 m" */
export interface SiteMeasure {
  id: string;
  label: string;
  value: number | null;
  unit: 'm²' | 'm³' | 'lm' | 'm' | 'ea';
  trade: string;
}

export const MEASURE_UNITS: SiteMeasure['unit'][] = ['m²', 'lm', 'm³', 'm', 'ea'];
export const SITE_TRADES = ['Carpenter', 'Demolition', 'Plumber', 'Electrician', 'Tiler', 'Waterproofer', 'Plasterer', 'Painter', 'Concreter', 'Roofer', 'Landscaper', 'Flooring', 'Cabinetmaker', 'General'];

export interface SiteRoom {
  id: string;
  name: string;
  type: RoomType;
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  /** floor area typed directly, for rooms that are not a rectangle */
  areaM2?: number | null;
  /** other measurements, each becomes its own estimate line */
  measures?: SiteMeasure[];
  /** ticked checklist keys */
  scope: string[];
  /** extra scope typed or dictated on site */
  notes: string;
  photos: SitePhoto[];
}

export interface SiteVisit {
  id: string;
  /** Metricore project this visit belongs to (null until linked) */
  projectId: string | null;
  jobName: string;
  address: string;
  clientName: string;
  /** whole-job notes: access, parking, power, asbestos age, owner wishes */
  notes: string;
  rooms: SiteRoom[];
  status: 'draft' | 'sent';
  createdAt: string;
  updatedAt: string;
  /** updatedAt of the copy the cloud last accepted (this phone's bookkeeping) */
  syncedAt?: string;
}

export type RoomType = 'bathroom' | 'kitchen' | 'laundry' | 'bedroom' | 'living' | 'toilet' | 'outdoor' | 'other';

export const ROOM_TYPES: { type: RoomType; label: string; defaultHeight: number }[] = [
  { type: 'bathroom', label: 'Bathroom', defaultHeight: 2.4 },
  { type: 'kitchen', label: 'Kitchen', defaultHeight: 2.4 },
  { type: 'laundry', label: 'Laundry', defaultHeight: 2.4 },
  { type: 'toilet', label: 'Toilet', defaultHeight: 2.4 },
  { type: 'bedroom', label: 'Bedroom', defaultHeight: 2.4 },
  { type: 'living', label: 'Living area', defaultHeight: 2.4 },
  { type: 'outdoor', label: 'Deck or outdoor', defaultHeight: 0 },
  { type: 'other', label: 'Other', defaultHeight: 2.4 },
];

const o = (key: string, label: string, trade: string, unit: ScopeOption['unit'], qtyFrom: QtyBasis): ScopeOption => ({ key, label, trade, unit, qtyFrom });

const STRIP = o('strip', 'Strip out', 'Demolition', 'm²', 'floor');
const PLASTER = o('plaster_walls', 'Plasterboard walls', 'Plasterer', 'm²', 'walls');
const CEILING = o('ceiling', 'Ceiling lining', 'Plasterer', 'm²', 'ceiling');
const CORNICE = o('cornice', 'Cornice', 'Plasterer', 'lm', 'perimeter');
const PAINT_WALLS = o('paint_walls', 'Paint walls', 'Painter', 'm²', 'walls');
const PAINT_CEIL = o('paint_ceiling', 'Paint ceiling', 'Painter', 'm²', 'ceiling');
const SKIRTING = o('skirting', 'Skirting', 'Carpenter', 'lm', 'perimeter');
const POWER = o('power_point', 'Power point', 'Electrician', 'ea', 'each');
const LIGHT = o('light_point', 'Light point', 'Electrician', 'ea', 'each');
const SMOKE = o('smoke_alarm', 'Smoke alarm', 'Electrician', 'ea', 'each');

/** Australian renovation checklist per room (Yann to adjust after the first real visit) */
export const SCOPE_BY_ROOM: Record<RoomType, ScopeOption[]> = {
  bathroom: [
    STRIP, o('demo_tiles', 'Remove wall and floor tiles', 'Demolition', 'm²', 'walls'),
    o('waterproof', 'Waterproofing (AS 3740)', 'Waterproofer', 'm²', 'floor'),
    o('screed', 'Floor screed and falls', 'Tiler', 'm²', 'floor'),
    o('tile_floor', 'Tile floor', 'Tiler', 'm²', 'floor'), o('tile_walls', 'Tile walls', 'Tiler', 'm²', 'walls'),
    o('fc_walls', 'FC sheet walls (wet area)', 'Plasterer', 'm²', 'walls'), CEILING,
    o('vanity', 'Vanity and basin', 'Plumber', 'ea', 'each'), o('toilet', 'Toilet suite', 'Plumber', 'ea', 'each'),
    o('shower', 'Shower set and screen', 'Plumber', 'ea', 'each'), o('bath', 'Bath', 'Plumber', 'ea', 'each'),
    o('exhaust', 'Exhaust fan', 'Electrician', 'ea', 'each'), LIGHT, POWER, PAINT_CEIL,
  ],
  kitchen: [
    STRIP, o('cabinets', 'Kitchen cabinets', 'Cabinetmaker', 'lm', 'each'), o('benchtop', 'Benchtop', 'Cabinetmaker', 'lm', 'each'),
    o('splashback', 'Splashback', 'Tiler', 'm²', 'each'), o('sink', 'Sink and mixer', 'Plumber', 'ea', 'each'),
    o('dishwasher', 'Dishwasher connection', 'Plumber', 'ea', 'each'), o('cooktop', 'Cooktop and oven', 'Electrician', 'ea', 'each'),
    o('rangehood', 'Rangehood', 'Electrician', 'ea', 'each'), o('floor_kitchen', 'New floor', 'Flooring', 'm²', 'floor'),
    POWER, LIGHT, PLASTER, PAINT_WALLS, PAINT_CEIL,
  ],
  laundry: [
    STRIP, o('waterproof', 'Waterproofing (AS 3740)', 'Waterproofer', 'm²', 'floor'), o('tile_floor', 'Tile floor', 'Tiler', 'm²', 'floor'),
    o('tub', 'Laundry tub and cabinet', 'Plumber', 'ea', 'each'), o('washer', 'Washing machine taps and waste', 'Plumber', 'ea', 'each'),
    POWER, PAINT_WALLS,
  ],
  toilet: [STRIP, o('toilet', 'Toilet suite', 'Plumber', 'ea', 'each'), o('tile_floor', 'Tile floor', 'Tiler', 'm²', 'floor'), o('exhaust', 'Exhaust fan', 'Electrician', 'ea', 'each'), PAINT_WALLS],
  bedroom: [o('floor_bed', 'New floor covering', 'Flooring', 'm²', 'floor'), PLASTER, CORNICE, SKIRTING, o('robe', 'Built-in robe', 'Carpenter', 'ea', 'each'), o('door', 'Door', 'Carpenter', 'ea', 'each'), POWER, LIGHT, SMOKE, PAINT_WALLS, PAINT_CEIL],
  living: [o('floor_living', 'New floor', 'Flooring', 'm²', 'floor'), PLASTER, CEILING, CORNICE, SKIRTING, o('wall_remove', 'Remove wall (engineer to check)', 'Carpenter', 'item', 'each'), POWER, LIGHT, PAINT_WALLS, PAINT_CEIL],
  outdoor: [o('deck', 'Decking', 'Carpenter', 'm²', 'floor'), o('deck_frame', 'Deck frame', 'Carpenter', 'm²', 'floor'), o('balustrade', 'Balustrade', 'Carpenter', 'lm', 'perimeter'), o('stairs', 'Stairs', 'Carpenter', 'item', 'each'), o('paving', 'Paving', 'Landscaper', 'm²', 'floor'), o('roof_cover', 'Roof cover', 'Roofer', 'm²', 'floor')],
  other: [STRIP, PLASTER, CEILING, PAINT_WALLS, PAINT_CEIL, POWER, LIGHT],
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface RoomQuantities { floor: number; ceiling: number; walls: number; perimeter: number }

/** Floor, ceiling, wall area and perimeter from length x width x height (openings not deducted). */
export function roomQuantities(r: Pick<SiteRoom, 'lengthM' | 'widthM' | 'heightM'> & { areaM2?: number | null }): RoomQuantities {
  const l = Number(r.lengthM) || 0, w = Number(r.widthM) || 0, h = Number(r.heightM) || 0;
  // A typed floor area wins (L-shaped rooms); walls still need length and width
  const floor = Number(r.areaM2) > 0 ? Number(r.areaM2) : l * w;
  const perimeter = l > 0 && w > 0 ? 2 * (l + w) : 0;
  return { floor: r2(floor), ceiling: r2(floor), walls: r2(perimeter * h), perimeter: r2(perimeter) };
}

/** The quantity a ticked item starts with; counted items start at 1 and are edited on the desktop. */
export function scopeQuantity(opt: ScopeOption, q: RoomQuantities): number {
  if (opt.qtyFrom === 'each') return 1;
  return q[opt.qtyFrom];
}

export function newVisit(): SiteVisit {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), projectId: null, jobName: '', address: '', clientName: '', notes: '', rooms: [], status: 'draft', createdAt: now, updatedAt: now };
}

export function newRoom(type: RoomType, existing: SiteRoom[]): SiteRoom {
  const t = ROOM_TYPES.find(x => x.type === type)!;
  const same = existing.filter(r => r.type === type).length;
  return {
    id: crypto.randomUUID(), name: same ? `${t.label} ${same + 1}` : t.label, type,
    lengthM: null, widthM: null, heightM: t.defaultHeight || null, scope: [], notes: '', photos: [],
  };
}

/** Two copies of one visit (phone and cloud): the newer wins whole; photos uploaded on either side are kept. */
export function mergeVisits(a: SiteVisit, b: SiteVisit): SiteVisit {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const older = newer === a ? b : a;
  const paths = new Map<string, string>();
  for (const room of older.rooms) for (const p of room.photos) if (p.path) paths.set(p.id, p.path);
  return {
    ...newer,
    // the office links a visit to a project; an unlinked copy never undoes that
    projectId: newer.projectId ?? older.projectId,
    rooms: newer.rooms.map(room => ({ ...room, photos: room.photos.map(p => (p.path || !paths.has(p.id) ? p : { ...p, path: paths.get(p.id) })) })),
  };
}
