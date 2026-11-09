import { rescaleMeasurementsForScale } from '@/lib/takeoff/rescaleForScale';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
const base = { worldPoints: [], worldValue: 0, color: '', label: '', timestamp: '' } as any;
const ms = [
  { ...base, id: 'l', type: 'line', unit: 'LM', realValue: 3.997, pageIndex: 0, computedM2: 3.997 * 2.4 },
  { ...base, id: 'a', type: 'polygon', unit: 'M2', realValue: 15.976, pageIndex: 0, computedM3: 1.5976 },
  { ...base, id: 'c', type: 'line', unit: 'count', realValue: 4, pageIndex: 0 },
  { ...base, id: 'o', type: 'line', unit: 'LM', realValue: 2, pageIndex: 1 },
];
// the old scale read 3.997 m where the plan says 4.000 m
const out = rescaleMeasurementsForScale(ms, 0, 100, 100 * 3.997 / 4);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
expect('length corrected', near(out[0].realValue, 4), out[0].realValue);
expect('wall area follows length', near(out[0].computedM2!, 4 * 2.4), out[0].computedM2);
expect('area by the square', near(out[1].realValue, 15.976 * (4 / 3.997) ** 2), out[1].realValue);
expect('slab volume follows area', near(out[1].computedM3!, 1.5976 * (4 / 3.997) ** 2), out[1].computedM3);
expect('count unchanged', out[2].realValue === 4);
expect('other page unchanged', out[3] === ms[3]);
expect('same scale: same list', rescaleMeasurementsForScale(ms, 0, 100, 100) === ms);
expect('first calibration: nothing to rescale', rescaleMeasurementsForScale(ms, 0, 0, 100) === ms);
if (failures) { console.log(`${failures} rescale failures`); process.exit(1); }
console.log('all scale correction tests passed');
