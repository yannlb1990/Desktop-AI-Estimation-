import { normaliseTrade, sumByTrade, sortTrades, labourRateForTrade, TRADES } from '@/lib/trades';
import { renameLineTrades } from '@/lib/estimate/tradeNames';
import { priceLine, DEFAULT_ESTIMATE_CONFIG } from '@/lib/pricing/estimatePricing';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };

expect('person names', normaliseTrade('Carpenter') === 'Carpentry' && normaliseTrade('plumber ') === 'Plumbing' && normaliseTrade('Electrician') === 'Electrical');
expect('cabinetry is joinery', normaliseTrade('Cabinetmaker') === 'Joinery' && normaliseTrade('cabinetry') === 'Joinery');
expect('labour list names', normaliseTrade('Civil / Excavation') === 'Site Works' && normaliseTrade('General Labour') === 'General' && normaliseTrade('Insulation Installer') === 'Insulation');
expect('own trade kept', normaliseTrade('Pool builder') === 'Pool builder');
expect('canonical kept', TRADES.every(t => normaliseTrade(t) === t));
expect('plural', normaliseTrade('Plumbers') === 'Plumbing');
expect('sum by trade', JSON.stringify(sumByTrade({ Carpenter: 100, Carpentry: 50.5, Tiler: 10 })) === JSON.stringify({ Carpentry: 150.5, Tiling: 10 }));
expect('sort', JSON.stringify(sortTrades(['Painting', 'Zed', 'Concrete', 'Abc'])) === JSON.stringify(['Concrete', 'Painting', 'Abc', 'Zed']));

const rates = { Carpenter: 92, Tiler: 88, Plumber: 105 };
expect('trade borrows person rate', labourRateForTrade('Carpentry', rates) === 92 && labourRateForTrade('Tiling', rates) === 88);
expect('old name rate unchanged', labourRateForTrade('Carpenter', rates) === 92 && labourRateForTrade('Insulation Installer', rates) === undefined);

// renaming never changes a price
const line = (trade: string, labour_rate: number, extra: any = {}) => ({ id: trade, trade, quantity: 10, unit: 'm²', unit_price: 40, labour_hours: 3, labour_rate, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 20, ...extra });
const items = [line('Carpenter', 70), line('Insulation Installer', 65), line('Steel Fixer', 60), line('Cabinetmaker', 80, { labour_hours: 0 }), line('Plumbing', 90), line('Own trade', 50)];
const r2 = { ...rates, 'Steel Fixer': 102, Concreter: 88 };
const renamed = renameLineTrades(items, r2, 90);
expect('renamed', renamed.map(i => i.trade).join() === 'Carpentry,Insulation,Concrete,Joinery,Plumbing,Own trade', renamed.map(i => i.trade));
items.forEach((it, k) => {
  const a = priceLine(it as any, DEFAULT_ESTIMATE_CONFIG, r2).total;
  const b = priceLine(renamed[k] as any, DEFAULT_ESTIMATE_CONFIG, r2).total;
  expect(`same price ${it.trade}`, Math.abs(a - b) < 1e-9, [a, b]);
});
expect('no change returns same array', renameLineTrades(renamed, r2, 90) === renamed);

if (failures) { console.log(`${failures} trade failures`); process.exit(1); }
console.log('all trade tests passed');
