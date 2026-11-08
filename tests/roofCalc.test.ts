import { roofGeometry, roofLines, defaultRoof } from '@/lib/estimate/roofCalc';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
const near = (a: number, b: number, t = 0.02) => Math.abs(a - b) <= t;

// flat 10 x 6 gable, no eaves: area 60, ridge 10, barge 4 x 3 = 12, gutters 20
const flat = roofGeometry({ lengthM: 10, widthM: 6, eavesM: 0, pitchDeg: 0, shape: 'gable' });
expect('flat gable', flat.roofArea === 60 && flat.ridge === 10 && flat.barge === 12 && flat.gutter === 20, flat);
// 30 degrees: area x 1/cos30 = 1.1547
const g30 = roofGeometry({ lengthM: 10, widthM: 6, eavesM: 0, pitchDeg: 30, shape: 'gable' });
expect('pitch factor', near(g30.pitchFactor, 1.1547, 0.0005) && near(g30.roofArea, 69.28), g30);
expect('barge along the slope', near(g30.barge, 4 * 3 / Math.cos(Math.PI / 6)), g30);
// hip 10 x 6 at 0 deg: ridge 4, each hip = run x sqrt2 = 3 x 1.414 = 4.243, gutter 32
const hip = roofGeometry({ lengthM: 10, widthM: 6, eavesM: 0, pitchDeg: 0, shape: 'hip' });
expect('hip roof', hip.ridge === 4 && near(hip.hips, 16.97) && hip.gutter === 32 && hip.barge === 0, hip);
// eaves add to both directions
const eav = roofGeometry({ lengthM: 10, widthM: 6, eavesM: 0.5, pitchDeg: 0, shape: 'gable' });
expect('eaves', eav.planArea === 77 && eav.ridge === 11, eav);
const sk = roofGeometry({ lengthM: 10, widthM: 6, eavesM: 0, pitchDeg: 5, shape: 'skillion' });
expect('skillion', sk.ridge === 0 && sk.hips === 0 && sk.gutter === 10, sk);

const lines = roofLines(defaultRoof(), 'QLD');
expect('lines priced', lines.length > 5 && lines.every(l => l.trade === 'Roofing' && l.quantity > 0 && l.unitPrice > 0), lines);
const sheets = lines.find(l => l.scope === 'Colorbond roofing')!;
const sarking = lines.find(l => l.scope === 'Sarking')!;
expect('waste on sheets only', near(sheets.quantity, sarking.quantity * 1.05, 0.05), [sheets.quantity, sarking.quantity]);
const tiles = roofLines({ ...defaultRoof(), material: 'terracotta' }, 'QLD');
expect('tiles get battens, no blanket', tiles.some(l => l.scope === 'Roof battens') && !tiles.some(l => l.scope === 'Roof insulation blanket'));
const over = roofLines({ ...defaultRoof(), overrides: { ridge: 20, hips: 0 } }, 'QLD');
expect('overrides win', over.find(l => l.scope === 'Ridge and hip capping')!.quantity === 20);
if (failures) { console.log(`${failures} roof failures`); process.exit(1); }
console.log('all roof calculator tests passed');
