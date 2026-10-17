import { checkEstimate } from '@/lib/estimate/checks';
import { DEFAULT_ESTIMATE_CONFIG } from '@/lib/pricing/estimatePricing';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };
const run = (item: any) => checkEstimate([{ id: 'x', trade: 'Carpenter', quantity: 10, unit: 'm²', unit_price: 50, labour_hours: 2, scope_of_work: 'Wall framing', material_type: 'MGP10 90x45', ...item }], DEFAULT_ESTIMATE_CONFIG, {}).map(c => c.message);
const has = (msgs: string[], text: string) => msgs.some(m => m.includes(text));

// Cases from Yann's project, 2026-10-18
expect('$0 wall framing line', has(run({ unit_price: 0, labour_hours: 0 }), 'No price'));
expect('decking 90 h for 23 lm', has(run({ quantity: 23, unit: 'lm', labour_hours: 90 }), 'check the hours'));
expect('material "cle"', has(run({ material_type: 'cle' }), 'looks unfinished'));
expect('material "lineal"', has(run({ material_type: 'lineal' }), 'looks unfinished'));
expect('0.06 m² floor from the plan', has(run({ quantity: 0.06, plan_link: { measurementIds: ['m1'] } }), 'stray click'));
expect('scope not chosen', has(run({ scope_of_work: '19.98 m²' }), 'Scope of work not chosen'));
expect('deleted measurement', has(run({ plan_link: { measurementIds: ['m1'], broken: true } }), 'deleted'));

// Normal lines raise nothing
expect('normal line is clean', run({}).length === 0);
expect('N12 bar material is fine', run({ material_type: 'N12' }).length === 0);
expect('slab 0.74 m³ is not tiny', run({ quantity: 0.74, unit: 'm³', plan_link: { measurementIds: ['m1'] } }).length === 0);
expect('labour-only line is priced', run({ quantity: 0, unit_price: 0, labour_hours: 4 }).filter(m => m.includes('No price') || m.includes('Quantity is 0')).length === 0);
expect('door hang 3 h each is fine', run({ quantity: 4, unit: 'ea', labour_hours: 12 }).length === 0);

// False alarms the review found (2026-10-18): real materials, real scopes, lump sums, credits
for (const m of ['PB', 'FC', 'MDF', 'OSB', 'PVC', 'LVL', 'Ply', 'HMR']) expect(`material ${m} is real`, run({ material_type: m }).length === 0);
for (const sc of ['Concrete slab', 'Framing', 'Cladding', 'Waterproofing', 'Painting', 'Insulation']) expect(`scope ${sc} is real`, run({ scope_of_work: sc }).length === 0);
expect('supervision 1 item 80 h', run({ quantity: 1, unit: 'item', labour_hours: 80 }).length === 0);
expect('shower base 1.5 m2 6 h', run({ quantity: 1.5, labour_hours: 6 }).length === 0);
expect('hand dig 0.5 m3 8 h', run({ quantity: 0.5, unit: 'm³', labour_hours: 8 }).length === 0);
expect('credit line is not $0', run({ quantity: 1, unit: 'item', unit_price: -500, labour_hours: 0 }).length === 0);
expect('owner supplied $0 is only a check', run({ material_type: 'Owner supplied tiles', unit_price: 0, labour_hours: 0 }).every(m => !m.includes('No price')));
expect('placeholder "Floor - Kitchen" still flagged', has(run({ scope_of_work: 'Floor - Kitchen' }), 'not chosen'));

if (failures) { console.log(`${failures} estimate check failures`); process.exit(1); }
console.log('all estimate check tests passed');
