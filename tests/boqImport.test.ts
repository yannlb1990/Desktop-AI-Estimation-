import { parseBoq, reconcile, normaliseUnit, parseNumber, tradeFromText, areaFromText } from '@/lib/estimate/boqImport';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };

expect('numbers', parseNumber('$1,250.50') === 1250.5 && parseNumber('(300)') === -300 && isNaN(parseNumber('-')) && isNaN(parseNumber('abc')));
expect('units', normaliseUnit('m2') === 'm²' && normaliseUnit('SQM') === 'm²' && normaliseUnit('No.') === 'ea' && normaliseUnit('lin m') === 'lm' && normaliseUnit('Sum') === 'item' && normaliseUnit('m3') === 'm³');
expect('trade words', tradeFromText('HYDRAULIC SERVICES') === 'Plumbing' && tradeFromText('Supply and lay 100mm slab') === 'Concrete' && tradeFromText('Garage door panel lift') === 'Garage Doors');
expect('area', areaFromText('BATHROOM 2 - TILING') === 'Bathroom 2' && areaFromText('ensuite') === 'Ensuite');

// A trade-by-trade QS BOQ with a header, multi-row descriptions, subtotals and a grand total
const qs: string[][] = [
  ['Project: 12 Smith St'],
  ['Item', 'Description', 'Qty', 'Unit', 'Rate', 'Amount'],
  ['1.0', 'PRELIMINARIES'],
  ['1.1', 'Site establishment and amenities', '1', 'item', '2500', '2,500.00'],
  ['2.0', 'CONCRETE'],
  ['2.1', 'Supply and place 100mm N25 slab on ground', '', '', '', ''],
  ['', 'including SL82 mesh and vapour barrier', '120', 'm2', '95', '11,400.00'],
  ['2.2', 'Strip footings', '8.5', 'm3', '520.00', '4420'],
  ['', 'Subtotal Concrete', '', '', '', '15,820.00'],
  ['3.0', 'HYDRAULIC SERVICES'],
  ['3.1', 'Tapware PC sum', '1', 'item', '1,500.00', '1,500.00'],
  ['3.2', 'Stormwater connection provisional sum', '', '', '', '2500'],
  ['3.3', 'Rough-in fixture points', '6', 'No', '650', '3,900.00'],
  ['', 'Carried forward', '', '', '', '23,720.00'],
  ['', 'GRAND TOTAL', '', '', '', '$26,220.00'],
];
const p = parseBoq(qs);
expect('header found', p.columns.headerRow === 1 && p.columns.description === 1 && p.columns.amount === 5, p.columns);
expect('six priced rows', p.rows.length === 6, p.rows.map(r => r.text));
const slab = p.rows.find(r => /slab/i.test(r.text))!;
expect('description joined over rows', /slab on ground including SL82 mesh/.test(slab.text) && slab.quantity === 120 && slab.unit === 'm²', slab);
expect('heading trades', p.rows[0].trade === 'Preliminaries' && slab.trade === 'Concrete' && p.rows[3].trade === 'Plumbing', p.rows.map(r => r.trade));
expect('PC and PS', p.rows[3].allowance === 'PC' && p.rows[4].allowance === 'PS', p.rows.map(r => r.allowance));
expect('lump sum without qty', p.rows[4].quantity === 1 && p.rows[4].unit === 'item' && p.rows[4].rate === 2500);
expect('subtotal and c/f skipped', p.skipped.some(s => /Subtotal/.test(s.text)) && p.skipped.some(s => /Carried/.test(s.text)));
const rec = reconcile(p.rows, p.boqTotal);
expect('reconciles to the cent', rec.boqTotal === 26220 && rec.imported === 26220 && rec.difference === 0, rec);
expect('scope keeps the words', p.rows[2].scope === 'Strip footings');
expect('item number from the first description row', slab.itemNo === '2.1', slab.itemNo);
const sections = parseBoq([['Item', 'Description', 'Qty', 'Unit', 'Rate', 'Amount'], ['3.0', 'BATHROOM 1'], ['3.1', 'Wall tiling', '22', 'm2', '85', '1870'], ['4.0', 'HYDRAULIC SERVICES'], ['4.1', 'Stormwater connection', '1', 'item', '2500', '2500']]);
expect('new section leaves the room', sections.rows[0].area === 'Bathroom 1' && sections.rows[1].area === '' && sections.rows[1].trade === 'Plumbing', sections.rows);

// A room-by-room BOQ without a header and with a qty x rate mismatch
const rooms: string[][] = [
  ['KITCHEN'],
  ['Base cabinets', '4.2', 'lm', '1100', '4620'],
  ['Power point double', '6', 'no', '150', '950'],
  ['BATHROOM 1'],
  ['Wall tiling lay only', '22', 'm2', '85', '1870'],
  ['Waterproofing shower', '1', 'item', '650', '650'],
];
const r2 = parseBoq(rooms);
expect('guessed columns', r2.columns.headerRow === -1 && r2.rows.length === 4, r2);
expect('room areas', r2.rows[0].area === 'Kitchen' && r2.rows[2].area === 'Bathroom 1', r2.rows.map(r => r.area));
expect('kitchen heading is not joinery for power', r2.rows[1].trade === 'Electrical', r2.rows.map(r => r.trade));
expect('trades by words', r2.rows[0].trade === 'Joinery' && r2.rows[2].trade === 'Tiling' && r2.rows[3].trade === 'Waterproofing');
expect('mismatch flagged', r2.rows[1].issues.some(i => i.includes('Quantity x rate')), r2.rows[1].issues);
expect('no BOQ total', reconcile(r2.rows, r2.boqTotal).difference === null);

if (failures) { console.log(`${failures} BOQ import failures`); process.exit(1); }
console.log('all BOQ import tests passed');
