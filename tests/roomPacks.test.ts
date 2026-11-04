import { packLines, defaultPack } from '@/lib/estimate/roomPacks';
import { TRADE_SCOPES, findScope } from '@/data/tradeScopes';
import { TRADES } from '@/lib/trades';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };

// every trade in the list has a library entry, names unique within a trade
expect('library covers every trade', TRADES.every(t => Array.isArray(TRADE_SCOPES[t])));
for (const t of TRADES) {
  const names = TRADE_SCOPES[t].map(x => x.name.toLowerCase());
  expect(`unique scopes ${t}`, new Set(names).size === names.length);
}
expect('no engineered stone', !Object.values(TRADE_SCOPES).flat().some(x => /engineered stone|caesarstone|quartz/i.test(x.name)));
expect('find by old trade name', findScope('Plumber', 'tapware supply')?.allowance === 'PC');

for (const kind of ['kitchen', 'bathroom', 'laundry', 'robes'] as const) {
  const lines = packLines(defaultPack(kind), 'NSW');
  expect(`${kind} has lines`, lines.length > 0);
  expect(`${kind} all priced and counted`, lines.every(l => l.quantity > 0 && l.unitPrice >= 0 && TRADES.includes(l.trade)), lines);
}

const k = packLines({ ...defaultPack('kitchen'), baseLm: 4, islandLm: 2, overheadLm: 0, talls: 0 } as any, 'NSW');
const bench = k.find(l => l.scope === 'Kitchen benchtop, natural stone');
expect('benchtop = base + island', bench?.quantity === 6, bench);
expect('no overheads when 0', !k.some(l => l.scope === 'Kitchen overhead cabinets'));
expect('appliance allowance is PC at the amount', k.some(l => l.scope === 'Appliance package allowance' && l.allowance === 'PC' && l.unitPrice === 5000));
const prem = packLines({ ...defaultPack('kitchen'), finish: 'premium' } as any, 'NSW').find(l => l.scope === 'Kitchen base cabinets')!;
const std = packLines(defaultPack('kitchen'), 'NSW').find(l => l.scope === 'Kitchen base cabinets')!;
expect('premium costs more', prem.unitPrice > std.unitPrice);
const wa = packLines(defaultPack('kitchen'), 'WA').find(l => l.scope === 'Kitchen base cabinets')!;
expect('state factor', wa.unitPrice > std.unitPrice);
const lam = packLines({ ...defaultPack('kitchen'), benchtop: 'laminate', waterfalls: 2 } as any, 'NSW');
expect('no waterfall on laminate', !lam.some(l => l.scope === 'Stone waterfall end'));

const b = packLines({ ...defaultPack('bathroom'), vanity: 'double 1500', bath: true } as any, 'NSW');
const rough = b.find(l => l.scope === 'Rough-in per fixture point');
expect('points: shower + 2 basins + toilet + bath', rough?.quantity === 5, rough);
expect('tapware PC', b.some(l => l.scope === 'Tapware supply' && l.allowance === 'PC' && l.unitPrice === 1500));
expect('waterproofing in bathroom', b.some(l => l.trade === 'Waterproofing'));
expect('lines in the room', b.every(l => l.area === 'Bathroom'));
const ens = packLines({ ...defaultPack('bathroom'), room: 'Ensuite', vanity: 'none', screen: 'none' } as any, 'NSW');
expect('no mirror without vanity', !ens.some(l => l.trade === 'Shower Screens & Mirrors') && ens.every(l => l.area === 'Ensuite'));

if (failures) { console.log(`${failures} room pack failures`); process.exit(1); }
console.log('all room pack tests passed');
