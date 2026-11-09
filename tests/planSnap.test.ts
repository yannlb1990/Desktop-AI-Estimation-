import { buildPlanIndex, snapToPlan } from '@/lib/takeoff/planSnap';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
// a room 0..100 x 0..60 and a wall line across at x=50
const idx = buildPlanIndex([
  { x1: 0, y1: 0, x2: 100, y2: 0 }, { x1: 100, y1: 0, x2: 100, y2: 60 },
  { x1: 100, y1: 60, x2: 0, y2: 60 }, { x1: 0, y1: 60, x2: 0, y2: 0 },
  { x1: 50, y1: -10, x2: 50, y2: 70 },
]);
const c = snapToPlan(idx, 98, 3, 6);
expect('corner first', c?.kind === 'corner' && c.point.x === 100 && c.point.y === 0, c);
const x = snapToPlan(idx, 52, 2, 6);
expect('intersection of two lines', x?.kind === 'intersection' && Math.abs(x.point.x - 50) < 1e-6 && Math.abs(x.point.y) < 1e-6, x);
const l = snapToPlan(idx, 30, 2, 6);
expect('onto the line', l?.kind === 'line' && l.point.y === 0 && l.point.x === 30, l);
expect('nothing far away', snapToPlan(idx, 30, 30, 6) === null);
expect('no plan lines', snapToPlan(buildPlanIndex([]), 1, 1, 5) === null);
if (failures) { console.log(`${failures} plan snap failures`); process.exit(1); }
console.log('all plan snap tests passed');
