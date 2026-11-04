import { tradeCost, applySubbieQuote } from '@/lib/estimate/subbieAward';
import { priceLine, DEFAULT_ESTIMATE_CONFIG as cfg } from '@/lib/pricing/estimatePricing';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
const rates = { Tiler: 88, Carpenter: 92 };
const L = (id: string, o: any) => ({ id, trade: 'Tiling', area: 'Bathroom', quantity: 12.5, unit: 'm²', unit_price: 55, labour_hours: 9, labour_rate: 70, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 20, ...o });
const items = [
  L('a', {}),
  L('b', { area: 'Ensuite', quantity: 6, unit_price: 48, relatedMaterials: [{ quantity: 3, unit_price: 21.5, confirmed: true }] }),
  L('c', { trade: 'Tiler', area: 'Laundry', labour_hours: 0 }),
  L('d', { trade: 'Carpentry', unit_price: 30 }),
];
const before = tradeCost(items, 'Tiling', cfg, rates);
expect('cost counts old and new names', before > 0 && before === tradeCost(items, 'Tiler', cfg, rates));
const out = applySubbieQuote(items, 'Tiling', 6400, 'Smith Tiling', cfg, rates);
expect('trade cost equals the quote', Math.abs(tradeCost(out, 'Tiling', cfg, rates) - 6400) < 0.05, tradeCost(out, 'Tiling', cfg, rates));
expect('other trades untouched', out[3] === items[3]);
expect('same lines, rooms, quantities', out.length === 4 && out.every((l, k) => l.area === items[k].area && l.quantity === items[k].quantity));
expect('markup kept', out[0].markup_pct === 20);
expect('awarded marked', out.slice(0, 3).every(l => l.awarded_to === 'Smith Tiling'));
const sell = (ls: any[]) => ls.reduce((s, l) => s + priceLine(l, cfg, rates).total, 0);
expect('sell price follows with markup', Math.abs(sell(out.slice(0, 3)) - 6400 * 1.2) < 0.1, sell(out.slice(0, 3)));
const none = applySubbieQuote(items, 'Painting', 3000, 'Ace Painting', cfg, rates, { markupPct: 15 });
expect('no lines: one lump sum', none.length === 5 && none[4].trade === 'Painting' && none[4].unit_price === 3000 && none[4].markup_pct === 15);
expect('lump sum cost is the quote', tradeCost(none, 'Painting', cfg, rates) === 3000);
if (failures) { console.log(`${failures} subbie award failures`); process.exit(1); }
console.log('all subbie award tests passed');
