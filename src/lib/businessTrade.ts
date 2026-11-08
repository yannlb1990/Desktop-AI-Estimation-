/**
 * What the business does. A builder sees everything; a trade sees its own trades first,
 * its own count markers on the takeoff and its own standard quote wording. Nothing is
 * hidden for good: every trade is still one click away.
 */
import { getUserStorageKey } from '@/lib/localAuth';
import type { TradeName } from '@/lib/trades';

export type BusinessTrade = 'builder' | 'roofer' | 'carpenter' | 'electrician' | 'plumber' | 'bricklayer' | 'concreter' | 'cabinetmaker' | 'tiler' | 'demolition' | 'civil';

export interface TradeProfile {
  key: BusinessTrade;
  label: string;
  /** the trades this business prices, first in pickers; the first is the default on new lines */
  trades: TradeName[];
  /** names offered for the takeoff's count tool */
  countPresets: string[];
  inclusions: string[];
  exclusions: string[];
  /** room packs (kitchen, bathroom...) make sense for this business */
  roomPacks: boolean;
}

const BUILDER_INCLUSIONS = [
  'All labour and materials as specified in this quotation',
  'Site protection, cleanup and waste removal upon completion',
  'All applicable permits and council approvals',
  'Workmanship warranty: 7 years structural, 2 years general',
  'Public liability insurance coverage during works',
];
const BUILDER_EXCLUSIONS = [
  'Variations outside the agreed scope of works',
  'Asbestos, mould or hazardous material removal',
  'Landscaping and external works unless explicitly stated',
  'Electrical, plumbing and gas works unless specified',
  'Furniture, fittings and equipment (FF&E) unless stated',
];
const tradeIncl = (work: string) => [
  `Supply and installation of ${work} as listed in this quotation`,
  'Clean up of our own work areas and removal of our offcuts',
  'Workmanship warranty on our work',
  'Public liability insurance coverage during works',
];
const tradeExcl = (others: string) => [
  'Variations outside the agreed scope of works',
  `${others} unless listed in this quotation`,
  'Asbestos, mould or hazardous material removal',
  'Making good of work by other trades',
];

export const TRADE_PROFILES: TradeProfile[] = [
  { key: 'builder', label: 'Builder', trades: [], countPresets: ['Door: Internal', 'Door: External', 'Window', 'Downlight', 'Power point'],
    inclusions: BUILDER_INCLUSIONS, exclusions: BUILDER_EXCLUSIONS, roomPacks: true },
  { key: 'roofer', label: 'Roofer', trades: ['Roofing', 'Insulation', 'Scaffolding'], countPresets: ['Skylight', 'Roof vent', 'Downpipe', 'Penetration', 'Whirlybird'],
    inclusions: tradeIncl('roofing, flashings, gutters and downpipes'), exclusions: tradeExcl('Roof framing, ceilings and electrical work'), roomPacks: false },
  { key: 'carpenter', label: 'Carpenter', trades: ['Carpentry', 'Cladding', 'Windows & Doors', 'Insulation'], countPresets: ['Door: Internal', 'Door: External', 'Window', 'Stair', 'Beam'],
    inclusions: tradeIncl('carpentry'), exclusions: tradeExcl('Plastering, painting, plumbing and electrical work'), roomPacks: false },
  { key: 'electrician', label: 'Electrician', trades: ['Electrical', 'HVAC'], countPresets: ['Power point', 'Light point', 'Downlight', 'Switch', 'Data point', 'Smoke alarm', 'Exhaust fan', 'Ceiling fan'],
    inclusions: [...tradeIncl('electrical work'), 'Testing and certificate of compliance for electrical work'], exclusions: tradeExcl('Patching, painting and building work, supply authority fees'), roomPacks: false },
  { key: 'plumber', label: 'Plumber', trades: ['Plumbing'], countPresets: ['Toilet', 'Basin', 'Shower', 'Bath', 'Kitchen sink', 'Laundry tub', 'Hot water unit', 'Floor waste', 'Tap'],
    inclusions: [...tradeIncl('plumbing and drainage'), 'Compliance certificate for plumbing work'], exclusions: tradeExcl('Tapware and fixtures supplied by others, building work, excavation in rock'), roomPacks: true },
  { key: 'bricklayer', label: 'Bricklayer', trades: ['Brickwork', 'Render'], countPresets: ['Pier', 'Lintel', 'Window opening', 'Door opening'],
    inclusions: tradeIncl('brickwork and blockwork'), exclusions: tradeExcl('Supply of bricks, footings and scaffolding'), roomPacks: false },
  { key: 'concreter', label: 'Concreter', trades: ['Concrete', 'Site Works', 'External Works'], countPresets: ['Pier', 'Pad footing', 'Penetration', 'Pit'],
    inclusions: tradeIncl('concrete, reinforcement and formwork'), exclusions: tradeExcl('Excavation in rock, engineering, termite protection'), roomPacks: false },
  { key: 'cabinetmaker', label: 'Cabinetmaker', trades: ['Joinery', 'Appliances'], countPresets: ['Base cabinet', 'Overhead cabinet', 'Tall cabinet', 'Drawer bank', 'Vanity'],
    inclusions: tradeIncl('cabinetry, benchtops and hardware'), exclusions: tradeExcl('Plumbing and electrical connections, appliances unless listed, tiling'), roomPacks: true },
  { key: 'tiler', label: 'Tiler', trades: ['Tiling', 'Waterproofing'], countPresets: ['Floor waste', 'Niche', 'Step', 'Trim'],
    inclusions: tradeIncl('tiling and waterproofing'), exclusions: tradeExcl('Supply of tiles unless listed, plumbing fit-off, screens'), roomPacks: true },
  { key: 'demolition', label: 'Demolition', trades: ['Demolition', 'Waste & Cleaning', 'Site Works'], countPresets: ['Skip bin', 'Tree', 'Structure', 'Asbestos area'],
    inclusions: tradeIncl('demolition and removal'), exclusions: tradeExcl('Asbestos removal unless listed, service disconnections'), roomPacks: false },
  { key: 'civil', label: 'Civil works', trades: ['Site Works', 'Concrete', 'External Works', 'Landscaping'], countPresets: ['Pit', 'Manhole', 'Headwall', 'Tree', 'Pier'],
    inclusions: tradeIncl('civil works'), exclusions: tradeExcl('Rock excavation, contaminated soil, authority fees'), roomPacks: false },
];

const KEY = () => getUserStorageKey('business_trade');

export function getBusinessTrade(): BusinessTrade {
  try {
    const v = localStorage.getItem(KEY()) as BusinessTrade | null;
    return TRADE_PROFILES.some(p => p.key === v) ? (v as BusinessTrade) : 'builder';
  } catch { return 'builder'; }
}

export function setBusinessTrade(t: BusinessTrade) {
  try { localStorage.setItem(KEY(), t); } catch { /* this device only */ }
  window.dispatchEvent(new CustomEvent('business-trade-changed', { detail: t }));
}

export function tradeProfile(t: BusinessTrade = getBusinessTrade()): TradeProfile {
  return TRADE_PROFILES.find(p => p.key === t) ?? TRADE_PROFILES[0];
}

/** Trades in the order a picker should show them: the business's own first. */
export function orderTradesFor<T extends string>(all: T[], t: BusinessTrade = getBusinessTrade()): T[] {
  const own = tradeProfile(t).trades as string[];
  if (!own.length) return all;
  return [...all.filter(x => own.includes(x)), ...all.filter(x => !own.includes(x))];
}
