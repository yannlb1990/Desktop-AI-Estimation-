/**
 * Room packs: a kitchen, bathroom, laundry or robes described once (sizes and choices),
 * turned into ordinary estimate lines across every trade the room needs, each priced from
 * the scope library (src/data/tradeScopes.ts) for the project's state. Lines stay fully
 * editable afterwards; nothing here is priced anywhere else.
 */
import { findScope, scopeRate, type Allowance, type ScopeUnit } from '@/data/tradeScopes';
import type { TradeName } from '@/lib/trades';

export type PackKind = 'kitchen' | 'bathroom' | 'laundry' | 'robes';
export type Finish = 'budget' | 'standard' | 'premium';
export type Benchtop = 'natural stone' | 'porcelain' | 'laminate' | 'timber';

/** Cabinet prices against standard (melamine or thermofoil, custom made). */
export const FINISH_MULT: Record<Finish, number> = { budget: 0.65, standard: 1, premium: 1.4 };

export interface KitchenInput {
  kind: 'kitchen';
  room: string;
  finish: Finish;
  baseLm: number;
  overheadLm: number;
  islandLm: number;
  talls: number;
  benchtop: Benchtop;
  /** benchtop length; defaults to base run plus island */
  benchtopLm?: number;
  waterfalls: number;
  splashback: 'tiles' | 'glass or stone' | 'none';
  splashbackLm?: number;
  appliancesAllowance: number;
  powerPoints: number;
  downlights: number;
  removeExisting: boolean;
}

export interface BathroomInput {
  kind: 'bathroom';
  room: string;
  floorM2: number;
  wallTileM2: number;
  vanity: 'none' | '600' | '900' | '1200' | 'double 1500';
  vanityTop: boolean;
  screen: 'frameless' | 'semi-frameless' | 'none';
  bath: boolean;
  toilet: boolean;
  /** PC allowance for all the room's tapware */
  tapwareAllowance: number;
  niche: boolean;
  shavingCabinet: boolean;
  removeExisting: boolean;
}

export interface LaundryInput {
  kind: 'laundry';
  room: string;
  finish: Finish;
  baseLm: number;
  overheadLm: number;
  talls: number;
  benchtopLm: number;
  floorM2: number;
  splashM2: number;
}

export interface RobesInput {
  kind: 'robes';
  room: string;
  finish: Finish;
  builtInLm: number;
  walkInLm: number;
  linen: number;
}

export type PackInput = KitchenInput | BathroomInput | LaundryInput | RobesInput;

export interface PackLine {
  area: string;
  trade: TradeName;
  scope: string;
  unit: ScopeUnit;
  quantity: number;
  unitPrice: number;
  allowance?: Allowance;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function packLines(input: PackInput, state?: string | null): PackLine[] {
  const out: PackLine[] = [];
  const area = input.room.trim() || defaultRoom(input.kind);
  /** a line from the library; price given overrides it (allowance amounts), mult scales it */
  const add = (trade: TradeName, scopeName: string, qty: number, opts: { price?: number; mult?: number; unit?: ScopeUnit } = {}) => {
    const q = round2(qty);
    if (!(q > 0)) return;
    const lib = findScope(trade, scopeName);
    if (!lib) throw new Error(`no scope "${scopeName}" for ${trade}`);
    const unitPrice = opts.price ?? round2(scopeRate(lib, state) * (opts.mult ?? 1));
    out.push({ area, trade, scope: lib.name, unit: opts.unit ?? lib.unit, quantity: q, unitPrice, ...(lib.allowance ? { allowance: lib.allowance } : {}) });
  };

  if (input.kind === 'kitchen') {
    const m = FINISH_MULT[input.finish];
    if (input.removeExisting) add('Demolition', 'Remove existing kitchen', 1);
    add('Joinery', 'Kitchen base cabinets', input.baseLm, { mult: m });
    add('Joinery', 'Kitchen overhead cabinets', input.overheadLm, { mult: m });
    add('Joinery', 'Kitchen island cabinets', input.islandLm, { mult: m });
    add('Joinery', 'Pantry or oven tower', input.talls, { mult: m });
    const bench = input.benchtopLm ?? input.baseLm + input.islandLm;
    add('Joinery', `Kitchen benchtop, ${input.benchtop === 'porcelain' ? 'porcelain or sintered' : input.benchtop}`, bench);
    if (input.benchtop === 'natural stone' || input.benchtop === 'porcelain') add('Joinery', 'Stone waterfall end', input.waterfalls);
    if (bench > 0) add('Joinery', 'Sink and cooktop cut-outs', 2);
    if (input.baseLm + input.overheadLm + input.islandLm > 0) add('Joinery', 'Soft close hardware and handles', 1, { mult: m });
    const splashLm = input.splashbackLm ?? input.baseLm;
    if (input.splashback === 'tiles') add('Tiling', 'Kitchen splashback tiles', splashLm * 0.6);
    if (input.splashback === 'glass or stone') add('Joinery', 'Glass or stone splashback', splashLm);
    if (input.appliancesAllowance > 0) {
      add('Appliances', 'Appliance package allowance', 1, { price: round2(input.appliancesAllowance) });
      add('Appliances', 'Appliance installation', 4);
    }
    add('Plumbing', 'Rough-in per fixture point', 2);
    add('Plumbing', 'Fit-off per fixture point', 2);
    add('Plumbing', 'Dishwasher and fridge water connection', 1);
    add('Electrical', 'Power point (double)', input.powerPoints);
    add('Electrical', 'Oven and cooktop circuit', 1);
    add('Electrical', 'LED downlight', input.downlights);
    add('HVAC', 'Rangehood ducting', 1);
  }

  if (input.kind === 'bathroom') {
    if (input.removeExisting) add('Demolition', 'Remove existing bathroom', 1);
    const points = 1 + (input.vanity !== 'none' ? (input.vanity === 'double 1500' ? 2 : 1) : 0) + (input.toilet ? 1 : 0) + (input.bath ? 1 : 0);
    add('Plumbing', 'Rough-in per fixture point', points);
    add('Plumbing', 'Floor waste', 1);
    add('Plasterboard', 'Wet area board', input.wallTileM2);
    add('Waterproofing', 'Shower base and walls (to AS 3740)', 1);
    add('Waterproofing', 'Wet area floor', input.floorM2);
    add('Waterproofing', 'Waterproofing certificate', 1);
    add('Tiling', 'Screed and falls', input.floorM2);
    add('Tiling', 'Floor tiling (lay only)', input.floorM2);
    add('Tiling', 'Wall tiling (lay only)', input.wallTileM2);
    add('Tiling', 'Tile supply allowance', (input.floorM2 + input.wallTileM2) * 1.1);
    if (input.niche) add('Tiling', 'Feature niche', 1);
    add('Tiling', 'Tile trims and silicone', input.floorM2 > 0 ? 1 : 0);
    const vanityScope = { '600': 'Vanity unit 600mm', '900': 'Vanity unit 900mm', '1200': 'Vanity unit 1200mm', 'double 1500': 'Double vanity 1500mm' } as const;
    if (input.vanity !== 'none') {
      add('Joinery', vanityScope[input.vanity], 1);
      if (input.vanityTop) add('Joinery', 'Vanity top (stone or porcelain)', 1);
      add('Plumbing', 'Basin or sink supply', input.vanity === 'double 1500' ? 2 : 1);
    }
    if (input.screen === 'frameless') add('Shower Screens & Mirrors', 'Frameless shower screen', 1);
    if (input.screen === 'semi-frameless') add('Shower Screens & Mirrors', 'Semi-frameless shower screen', 1);
    add('Shower Screens & Mirrors', input.shavingCabinet ? 'Shaving cabinet' : 'Mirror (polished edge)', input.vanity !== 'none' ? 1 : 0);
    if (input.bath) add('Plumbing', 'Bath supply and install', 1);
    if (input.toilet) {
      add('Plumbing', 'Toilet suite supply', 1);
      add('Plumbing', 'Toilet suite install', 1);
    }
    if (input.tapwareAllowance > 0) add('Plumbing', 'Tapware supply', 1, { price: round2(input.tapwareAllowance) });
    add('Plumbing', 'Fit-off per fixture point', points);
    add('Electrical', 'Exhaust fan', 1);
    add('Electrical', 'LED downlight', 2);
    add('Electrical', 'Power point (double)', input.vanity !== 'none' ? 1 : 0);
  }

  if (input.kind === 'laundry') {
    const m = FINISH_MULT[input.finish];
    add('Joinery', 'Laundry base cabinets', input.baseLm, { mult: m });
    add('Joinery', 'Laundry overhead cabinets', input.overheadLm, { mult: m });
    add('Joinery', 'Laundry tall cupboard', input.talls, { mult: m });
    add('Joinery', 'Laundry benchtop', input.benchtopLm);
    if (input.benchtopLm > 0) add('Joinery', 'Sink and cooktop cut-outs', 1);
    add('Plumbing', 'Basin or sink supply', 1);
    add('Plumbing', 'Rough-in per fixture point', 2);
    add('Plumbing', 'Fit-off per fixture point', 2);
    add('Plumbing', 'Floor waste', input.floorM2 > 0 ? 1 : 0);
    add('Waterproofing', 'Wet area floor', input.floorM2);
    add('Tiling', 'Floor tiling (lay only)', input.floorM2);
    add('Tiling', 'Wall tiling (lay only)', input.splashM2);
    add('Tiling', 'Tile supply allowance', (input.floorM2 + input.splashM2) * 1.1);
    add('Electrical', 'Power point (double)', 2);
  }

  if (input.kind === 'robes') {
    const m = FINISH_MULT[input.finish];
    add('Joinery', 'Built-in robe (doors and fit-out)', input.builtInLm, { mult: m });
    add('Joinery', 'Walk-in robe fit-out', input.walkInLm, { mult: m });
    add('Joinery', 'Linen cupboard fit-out', input.linen, { mult: m });
  }

  return out;
}

export function defaultRoom(kind: PackKind): string {
  return kind === 'kitchen' ? 'Kitchen' : kind === 'bathroom' ? 'Bathroom' : kind === 'laundry' ? 'Laundry' : 'Bedroom 1';
}

export function defaultPack(kind: PackKind): PackInput {
  switch (kind) {
    case 'kitchen': return { kind, room: 'Kitchen', finish: 'standard', baseLm: 4.2, overheadLm: 2.4, islandLm: 2.4, talls: 1, benchtop: 'natural stone', waterfalls: 0, splashback: 'tiles', appliancesAllowance: 5000, powerPoints: 6, downlights: 6, removeExisting: false };
    case 'bathroom': return { kind, room: 'Bathroom', floorM2: 6, wallTileM2: 22, vanity: '900', vanityTop: true, screen: 'frameless', bath: false, toilet: true, tapwareAllowance: 1500, niche: true, shavingCabinet: false, removeExisting: false };
    case 'laundry': return { kind, room: 'Laundry', finish: 'standard', baseLm: 1.8, overheadLm: 1.8, talls: 0, benchtopLm: 1.8, floorM2: 4, splashM2: 1.5 };
    case 'robes': return { kind, room: 'Bedroom 1', finish: 'standard', builtInLm: 2.4, walkInLm: 0, linen: 0 };
  }
}
