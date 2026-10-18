import { slabLines, footingLines, trenchLines, perimeterOf } from '@/lib/takeoff/concreteItems';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };
const near = (a: number, b: number) => Math.abs(a - b) < 0.011;
const get = (ls: any[], k: string) => ls.find(l => l.key === k);

// 10 x 10 m slab, 100 mm, 300 wide x 400 deep edge beam
let ls = slabLines(100, 40, { thicknessMm: 100, edgeBeamWidthMm: 300, edgeBeamDepthMm: 400, meshSheetM2: 0, pump: true });
expect('concrete (10 + 3.6) x 1.05', near(get(ls, 'concrete').qty, 14.28));
expect('8 mesh sheets', get(ls, 'mesh').qty === 8);
expect('160 chairs', get(ls, 'chairs').qty === 160);
expect('membrane down both beam faces', near(get(ls, 'membrane').qty, (100 + 40 * 2 * 0.3) * 1.1));
expect('edge form 40 lm', near(get(ls, 'edgeform').qty, 40));
expect('beam dig 3.6', near(get(ls, 'beamdig').qty, 3.6));
expect('trench mesh 3 runs', near(get(ls, 'beamreo').qty, 126));
expect('pump', get(ls, 'pump').qty === 1);

// Yann's slab 4.96 m2 at 150 mm, no beam: 0.744 x 1.05
ls = slabLines(4.96, 9, { thicknessMm: 150, edgeBeamWidthMm: 0, edgeBeamDepthMm: 0, meshSheetM2: 0, pump: false });
expect('small slab concrete', near(get(ls, 'concrete').qty, 0.78));
expect('no beam lines', !get(ls, 'beamdig') && !get(ls, 'beamreo') && !get(ls, 'pump'));

// Strip footing 20 m, 450 x 600, 2 runs
ls = footingLines(20, { widthMm: 450, depthMm: 600, barsPerRun: 2 });
expect('footing dig 5.4', near(get(ls, 'dig').qty, 5.4));
expect('footing concrete 5.67', near(get(ls, 'concrete').qty, 5.67));
expect('footing reo 42', near(get(ls, 'reo').qty, 42));

// Trench 30 m, 450 x 900, 100 bedding, clay, 10 m3 truck
ls = trenchLines(30, { widthMm: 450, depthMm: 900, beddingMm: 100, soil: 'clay', truckM3: 10 });
expect('trench dig 12.15', near(get(ls, 'dig').qty, 12.15));
expect('bedding 1.35 + 10%', near(get(ls, 'bedding').qty, 1.49));
expect('backfill 10.8', near(get(ls, 'backfill').qty, 10.8));
expect('1 truck of spoil', get(ls, 'spoil').qty === 1);

// Perimeter from a drawn rectangle: 4 x 3 m at 2 drawing units per metre
expect('rectangle perimeter 14', near(perimeterOf({ type: 'rectangle', worldPoints: [{ x: 0, y: 0 }, { x: 8, y: 6 }], worldValue: 48, realValue: 12 }), 14));
expect('polygon perimeter 14', near(perimeterOf({ type: 'polygon', worldPoints: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }], worldValue: 48, realValue: 12 }), 14));

if (failures) { console.log(`${failures} concrete failures`); process.exit(1); }
console.log('all concrete and earthworks tests passed');
