import { fromUnrotated, toUnrotated, remapPoint, remapMeasurements } from '@/lib/takeoff/rotateWorld';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
const W = 595, H = 842;
// what pdf.js 5 gives for the same plan point at each rotation (checked against getViewport)
const at = { 0: { x: 100, y: 542 }, 90: { x: 300, y: 100 }, 180: { x: 495, y: 300 }, 270: { x: 542, y: 495 } } as const;
for (const r of [0, 90, 180, 270] as const) {
  const f = fromUnrotated(at[0], r, W, H);
  expect(`to ${r}`, f.x === at[r].x && f.y === at[r].y, f);
  const u = toUnrotated(at[r], r, W, H);
  expect(`back from ${r}`, u.x === at[0].x && u.y === at[0].y, u);
}
const p = remapPoint(at[90], 90, 180, W, H);
expect('90 to 180', p.x === at[180].x && p.y === at[180].y, p);
const ms = [{ id: 'a', pageIndex: 0, worldPoints: [at[0]] }, { id: 'b', pageIndex: 1, worldPoints: [at[0]] }] as any;
const out = remapMeasurements(ms, 0, 0, 270, W, H);
expect('page moved', out[0].worldPoints[0].x === 542 && out[0].worldPoints[0].y === 495, out[0]);
expect('other page kept', out[1] === ms[1]);
expect('same rotation: same list', remapMeasurements(ms, 0, 90, 90, W, H) === ms);
if (failures) { console.log(`${failures} rotation failures`); process.exit(1); }
console.log('all rotation tests passed');
