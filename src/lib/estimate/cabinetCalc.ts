/**
 * Cabinetry from its runs: each run (base, overhead, tall) is split into 600 mm carcasses,
 * then into what a cabinetmaker buys and makes: carcass board (sheets to order), door and
 * drawer fronts (m² by finish), drawers, hinges, runners, handles, kickboard, end panels,
 * benchtop. Every part is material plus labour hours, so the estimate shows the real cost.
 * The builder's own prices and hours replace the defaults (CabinetPrices).
 */
import { findScope, scopeRate } from '@/data/tradeScopes';
import type { PackLine } from '@/lib/estimate/roomPacks';

export type RunKind = 'base' | 'overhead' | 'tall';
export type FrontFinish = 'melamine' | 'laminate' | 'thermofoil' | 'two-pac' | 'veneer';

export interface CabinetRun { id: string; kind: RunKind; lengthM: number; drawerBanks: number }

export interface CabinetInput {
  room: string;
  runs: CabinetRun[];
  finish: FrontFinish;
  endPanels: number;
  benchtop: 'natural stone' | 'porcelain' | 'laminate' | 'timber' | 'none';
  benchtopLm: number;
  cutOuts: number;
  install: boolean;
}

export interface CabinetPrices {
  /** 16 mm carcass board, one 2400 x 1200 sheet */
  boardSheet: number;
  /** door and drawer front material per m², by finish */
  front: Record<FrontFinish, number>;
  hinge: number;
  runnerPair: number;
  handle: number;
  kickboardLm: number;
  endPanel: number;
  /** hours to make one carcass, fit one door, build one drawer, install one carcass */
  hoursCarcass: number;
  hoursDoor: number;
  hoursDrawer: number;
  hoursInstall: number;
}

export const DEFAULT_CABINET_PRICES: CabinetPrices = {
  boardSheet: 95,
  front: { melamine: 45, laminate: 75, thermofoil: 110, 'two-pac': 230, veneer: 260 },
  hinge: 9, runnerPair: 48, handle: 16, kickboardLm: 28, endPanel: 120,
  hoursCarcass: 1.2, hoursDoor: 0.3, hoursDrawer: 0.6, hoursInstall: 0.6,
};

const MODULE_M = 0.6;
const SHEET_M2 = 2.4 * 1.2;
/** carcass board per 600 mm carcass (sides, bottom or top, back, one shelf), m² */
const CARCASS_M2: Record<RunKind, number> = { base: 1.91, overhead: 1.22, tall: 4.62 };
const FRONT_HEIGHT_M: Record<RunKind, number> = { base: 0.72, overhead: 0.72, tall: 2.1 };
const DRAWERS_PER_BANK = 3;

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface CabinetParts {
  carcasses: number; boardM2: number; sheets: number; frontsM2: number;
  doors: number; drawers: number; hinges: number; runners: number; handles: number; kickboardLm: number;
}

export function cabinetParts(i: CabinetInput): CabinetParts {
  let carcasses = 0, boardM2 = 0, frontsM2 = 0, doors = 0, drawers = 0, hinges = 0, kickboardLm = 0;
  for (const r of i.runs) {
    const len = Math.max(0, r.lengthM || 0);
    if (!len) continue;
    const n = Math.max(1, Math.round(len / MODULE_M));
    const banks = r.kind === 'base' ? Math.min(n, Math.max(0, Math.round(r.drawerBanks || 0))) : 0;
    carcasses += n;
    boardM2 += n * CARCASS_M2[r.kind];
    frontsM2 += len * FRONT_HEIGHT_M[r.kind];
    const runDoors = n - banks;
    doors += runDoors;
    drawers += banks * DRAWERS_PER_BANK;
    hinges += runDoors * (r.kind === 'tall' ? 4 : 2);
    if (r.kind !== 'overhead') kickboardLm += len;
  }
  return {
    carcasses, boardM2: r2(boardM2), sheets: Math.ceil((boardM2 * 1.15) / SHEET_M2), frontsM2: r2(frontsM2),
    doors, drawers, hinges, runners: drawers, handles: doors + drawers, kickboardLm: r2(kickboardLm),
  };
}

/** Lines for the estimate: material price per unit plus labour hours (priced at the joinery rate). */
export function cabinetLines(i: CabinetInput, prices: CabinetPrices = DEFAULT_CABINET_PRICES, state?: string | null): (PackLine & { labourHours: number })[] {
  const p = cabinetParts(i);
  const area = i.room.trim() || 'Kitchen';
  const out: (PackLine & { labourHours: number })[] = [];
  const add = (scope: string, unit: PackLine['unit'], quantity: number, unitPrice: number, labourHours = 0) => {
    const q = r2(quantity);
    if (!(q > 0)) return;
    out.push({ area, trade: 'Joinery', scope, unit, quantity: q, unitPrice: r2(unitPrice), labourHours: r2(labourHours) });
  };
  const install = i.install ? p.carcasses * prices.hoursInstall : 0;
  add(`Carcasses: 16 mm board, ${p.carcasses} carcasses (${p.sheets} sheets)`, 'ea', p.sheets, prices.boardSheet, p.carcasses * prices.hoursCarcass + install);
  add(`Door and drawer fronts, ${i.finish}`, 'm²', p.frontsM2, prices.front[i.finish], p.doors * prices.hoursDoor);
  add(`Drawers with soft close runners (${p.drawers})`, 'ea', p.drawers, prices.runnerPair, p.drawers * prices.hoursDrawer);
  add('Soft close hinges', 'ea', p.hinges, prices.hinge);
  add('Handles', 'ea', p.handles, prices.handle);
  add('Kickboard', 'lm', p.kickboardLm, prices.kickboardLm);
  add('End panels', 'ea', i.endPanels, prices.endPanel, i.endPanels * 0.5);
  if (i.benchtop !== 'none') {
    const lib = findScope('Joinery', `Kitchen benchtop, ${i.benchtop === 'porcelain' ? 'porcelain or sintered' : i.benchtop}`);
    if (lib) add(lib.name, 'lm', i.benchtopLm, scopeRate(lib, state));
    const cut = findScope('Joinery', 'Sink and cooktop cut-outs');
    if (cut) add(cut.name, 'ea', i.cutOuts, scopeRate(cut, state));
  }
  return out;
}

export const defaultCabinets = (): CabinetInput => ({
  room: 'Kitchen',
  runs: [
    { id: 'b1', kind: 'base', lengthM: 4.2, drawerBanks: 2 },
    { id: 'o1', kind: 'overhead', lengthM: 2.4, drawerBanks: 0 },
    { id: 't1', kind: 'tall', lengthM: 1.2, drawerBanks: 0 },
  ],
  finish: 'two-pac', endPanels: 2, benchtop: 'natural stone', benchtopLm: 4.2, cutOuts: 2, install: true,
});
