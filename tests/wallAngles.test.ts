import { cornerAngle, drawingCornerAngle, wallCorners, squareness } from '@/lib/takeoff/wallAngles';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, got ?? ''); } };
const near = (a: number, b: number, t = 0.01) => Math.abs(a - b) <= t;
const P = (x: number, y: number) => ({ x, y });
const wall = (id: string, pts: [number, number][]): any => ({ id, type: 'line', wallThickness: 90, worldPoints: pts.map(([x, y]) => P(x, y)) });

expect('right angle', near(cornerAngle(P(0, 0), P(10, 0), P(0, 10)), 90));
expect('obtuse', near(cornerAngle(P(0, 0), P(10, 0), P(-10, 10)), 135));
const walls = [wall('a', [[0, 0], [100, 0]])];
expect('drawing from the end of a wall', near(drawingCornerAngle(P(100, 0), P(100, 80), walls, 5)!, 90));
expect('drawing into the end of a wall, 2 degrees off', near(drawingCornerAngle(P(0, 100), P(0 + Math.tan(2 * Math.PI / 180) * 100, 0), walls, 5)!, 92, 0.05));
expect('touching nothing', drawingCornerAngle(P(50, 50), P(60, 90), walls, 5) === null);
const c = wallCorners([wall('a', [[0, 0], [100, 0]]), wall('b', [[100, 0], [101, 80]]), wall('c', [[101, 80], [201, 80]])], 2, 50);
expect('two corners', c.length === 2, c.length);
expect('off-square found', c.some(x => squareness(x.deg) === 'off'), c.map(x => x.deg));
expect('square label', squareness(90.3) === 'square' && squareness(75) === null);
expect('straight run is no corner', wallCorners([wall('a', [[0, 0], [100, 0]]), wall('b', [[100, 0], [200, 0]])], 2, 50).length === 0);
if (failures) { console.log(`${failures} wall angle failures`); process.exit(1); }
console.log('all wall angle tests passed');
