import { parseCSV, detectColumns, findHeaderRow, parsePrice, readPriceList, diffAgainstLibrary, estimateLinesToReprice } from '@/lib/materials/priceListImport';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };

// A supplier file with quotes, embedded commas, BOM and Windows line ends
const csv = '﻿Item Code,Description,UOM,RRP,Your Price ex GST\r\n' +
  'MGP10-9045,"Pine, MGP10 90 x 45",LM,$4.95,$3.85\r\n' +
  'FC-6,"FC Sheet 6mm 2400 x 1200",EA,"$42.00","$1,234.50"\r\n' +
  'NOPRICE,Sample item,EA,,\r\n';
const rows = parseCSV(csv);
expect('4 rows', rows.length === 4);
expect('comma inside quotes kept', rows[1][1] === 'Pine, MGP10 90 x 45');
expect('BOM stripped', rows[0][0] === 'Item Code');
const map = detectColumns(rows[0]);
expect('code col', map.code === 0);
expect('name col', map.name === 1);
expect('unit col', map.unit === 2);
expect('your price beats RRP', map.price === 4);
expect('price parse', parsePrice('$1,234.50') === 1234.5 && Number.isNaN(parsePrice('')));

const { items, skipped } = readPriceList(rows, map, { supplier: 'Timber Yard', pricesIncludeGst: false, defaultTrade: 'Carpenter' });
expect('2 items, 1 skipped (no price)', items.length === 2 && skipped === 1);
expect('item price', items[0].unitCost === 3.85 && items[0].unit === 'LM');
const inc = readPriceList(rows, map, { supplier: 'x', pricesIncludeGst: true, defaultTrade: 'General' }).items;
expect('inc GST -> ex GST', inc[0].unitCost === 3.5);

// Semicolon file (Excel in some locales)
const semi = parseCSV('Description;Price\nNoggings;2,30\n');
expect('semicolon delimiter', semi[1][0] === 'Noggings');

// Re-import: same code at the same supplier updates the price instead of duplicating
const lib: any[] = [
  { id: '1', name: 'MGP10 90x45 pine', productCode: 'MGP10-9045', supplierName: 'Timber Yard', unitCost: 3.6, unit: 'LM' },
  { id: '2', name: 'FC Sheet 6mm 2400 x 1200', productCode: '', supplierName: 'Timber Yard', unitCost: 1234.5, unit: 'EA' },
];
const diff = diffAgainstLibrary(items, lib, 'Timber Yard');
expect('price change found by code', diff.changed.length === 1 && diff.changed[0].from === 3.6 && diff.changed[0].to === 3.85);
expect('unchanged found by name', diff.unchanged === 1 && diff.added.length === 0);

// Estimate lines on the old price get repriced, approved quotes never
const projects = [
  { id: 'p1', name: 'Job A', estimate_items: [{ id: 'l1', material_type: 'MGP10 90x45 pine', scope_of_work: 'Framing', unit_price: 3.6, quantity: 100 }, { id: 'l2', material_type: 'MGP10 90x45 pine', unit_price: 4.2, quantity: 5 }] },
  { id: 'p2', name: 'Job B', quoteStatus: 'won', estimate_items: [{ id: 'l3', material_type: 'MGP10 90x45 pine', unit_price: 3.6, quantity: 50 }] },
];
const re = estimateLinesToReprice(projects, diff.changed);
expect('1 line repriced (typed price 4.20 left alone)', re.lines.length === 1 && re.lines[0].lineId === 'l1' && re.lines[0].to === 3.85);
expect('approved job locked', re.lockedProjects.includes('Job B'));

// Review 24 Oct: formats and matching
expect('European 2,30', parsePrice('2,30') === 2.3);
expect('European 1.234,50', parsePrice('1.234,50') === 1234.5);
expect('US 1,234.50', parsePrice('1,234.50') === 1234.5);
expect('semicolon file prices', readPriceList(parseCSV('Description;Price\nNoggings;2,30\n'), { name: 0, price: 1 }, { supplier: 's', pricesIncludeGst: false, defaultTrade: 'g' }).items[0].unitCost === 2.3);
const hdr = detectColumns(['No.', 'Item Code', 'Description', 'Price Unit', 'Price Break Qty', 'Sell Price']);
expect('No. is not the code', hdr.code === 1);
expect('Price Unit / Break Qty are not the price', hdr.price === 5);
const titled = parseCSV('Reece price list March 2026\nCode;Description;Price\nAB12;Basin mixer;189,00\n');
expect('header under a title line', findHeaderRow(titled) === 1 && titled[2][2] === '189,00');
const tot = readPriceList(parseCSV('Code,Description,Price\nA1,Thing,10\nA1,Thing,12\n,Total,22\n'), { code: 0, name: 1, price: 2 }, { supplier: 's', pricesIncludeGst: false, defaultTrade: 'g' });
expect('total row skipped, duplicate code merged (later wins)', tot.items.length === 1 && tot.items[0].unitCost === 12);
const other: any[] = [{ id: 'b', name: 'Pine MGP10 90x45', productCode: '', supplierName: 'Bunnings', unitCost: 4, unit: 'LM' }];
expect('other supplier keeps its price', diffAgainstLibrary([{ name: 'Pine MGP10 90x45', productCode: '', unit: 'LM', unitCost: 3, trade: '', notes: '' }], other, 'Timber Yard').added.length === 1);
const sameSup: any[] = [{ id: 'c', name: 'Pine MGP10 90x45', productCode: '', supplierName: 'Timber Yard', unitCost: 4, unit: 'LM' }];
expect('different unit is a different item', diffAgainstLibrary([{ name: 'Pine MGP10 90x45', productCode: '', unit: 'EA', unitCost: 23, trade: '', notes: '' }], sameSup, 'Timber Yard').added.length === 1);
const codeLine = estimateLinesToReprice([{ id: 'p', name: 'J', estimate_items: [{ id: 'x', material_type: 'Studs MGP10-9045 supplied', unit_price: 3.6, unit: 'LM', quantity: 1 }, { id: 'y', material_type: 'Plasterboard 10mm', unit_price: 3.6, unit: 'M2', quantity: 1 }] }], diff.changed);
expect('code with a dash matches, other lines do not', codeLine.lines.length === 1 && codeLine.lines[0].lineId === 'x');

if (failures) { console.log(`${failures} price list failures`); process.exit(1); }
console.log('all price list tests passed');
