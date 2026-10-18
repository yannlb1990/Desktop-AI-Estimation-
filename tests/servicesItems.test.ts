import { ELECTRICAL_POINTS, PLUMBING_FIXTURES, countsFromPlan, suggestElectrical, suggestHotWaterLitres, roomLoads, ductedSize } from '@/lib/estimate/servicesItems';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };

// Count markers named on the plan
const markers = [
  { id: 'a', label: 'Double GPO', unit: 'COUNT', realValue: 14 },
  { id: 'b', label: 'Downlight', unit: 'COUNT', realValue: 22 },
  { id: 'c', label: 'Smoke alarm', unit: 'COUNT', realValue: 4 },
  { id: 'd', label: 'Light switch', unit: 'COUNT', realValue: 9 },
  { id: 'e', label: 'Wall 1', unit: 'LM', realValue: 6 },
  { id: 'f', label: 'Downlights bed 2', unit: 'COUNT', realValue: 3 },
];
const el = countsFromPlan(ELECTRICAL_POINTS, markers);
expect('GPOs 14', el.gpo_double?.qty === 14);
expect('lights 22 + 3 from two markers', el.light?.qty === 25 && el.light.ids.length === 2);
expect('switch not counted as light', el.switch?.qty === 9);
expect('smoke 4', el.smoke?.qty === 4);
expect('lengths ignored', Object.values(el).every(v => !v.ids.includes('e')));

const pl = countsFromPlan(PLUMBING_FIXTURES, [{ id: 'w', label: 'WC', unit: 'COUNT', realValue: 2 }, { id: 'v', label: 'Vanity basin', unit: 'COUNT', realValue: 3 }]);
expect('2 toilets, 3 basins', pl.wc?.qty === 2 && pl.basin?.qty === 3);

// Board: 25 lights -> 2 circuits, 14 GPOs -> 2, oven + cooktop -> 2, RCBO each
const s = suggestElectrical({ light: 25, gpo_double: 14, oven: 1, cooktop: 1 }, 4, 1);
expect('lighting circuits 2', s.lightingCircuits === 2);
expect('power circuits 2', s.powerCircuits === 2);
expect('rcbos 6', s.rcbos === 6);
expect('smoke alarms at least 5 (4 bedrooms + 1 storey)', s.smokeAlarmsMin === 5);

expect('hot water 2 people 160', suggestHotWaterLitres(2) === 160);
expect('hot water 4 people 250', suggestHotWaterLitres(4) === 250);
expect('hot water 6 people 315', suggestHotWaterLitres(6) === 315);

// Rooms: living 35 m2 at 140 W = 4.9 kW -> 5.0 split; bedroom 12 m2 at 110 = 1.3 -> 2.5
const loads = roomLoads([{ name: 'Living', m2: 35 }, { name: 'Bedroom 1', m2: 12 }, { name: 'Hall', m2: 0 }]);
expect('2 rooms (zero area skipped)', loads.length === 2);
expect('living 4.9 kW -> 5.0', loads[0].kw === 4.9 && loads[0].splitKw === 5.0);
expect('bedroom 1.3 kW -> 2.5', loads[1].kw === 1.3 && loads[1].splitKw === 2.5);
const d = ductedSize(loads);
expect('ducted 6.2 kW total, 80% -> 7.1 unit', d.totalKw === 6.2 && d.unitKw === 7.1);
expect('outlets: living 2, bedroom 1', d.outlets === 3);

const mix = countsFromPlan(ELECTRICAL_POINTS, [{ id: 's', label: 'Single GPO', unit: 'COUNT', realValue: 2 }, { id: 'o', label: 'Outdoor light', unit: 'COUNT', realValue: 3 }]);
expect('single GPO not double', mix.gpo_single?.qty === 2 && !mix.gpo_double);
expect('outdoor light not a light point', mix.outdoor?.qty === 3 && !mix.light);

// Legend names from the review (18 Oct)
const names: [string, string | null][] = [
  ['Double switched GPO', 'gpo_double'], ['DSGPO', 'gpo_double'], ['Single GPO', 'gpo_single'], ['Outdoor GPO', 'gpo_double'],
  ['Dishwasher GPO', 'gpo_double'], ['Switchboard', null], ['Light switch 2 gang', 'switch'], ['Skylight', null],
  ['Highlight window', null], ['Sensor light', 'outdoor'], ['LED downlight', 'light'], ['Fan coil', null],
  ['Ceiling fan', 'fan'], ['Gas cooktop', null], ['Gas HWS', null], ['Smoke detector', 'smoke'],
];
for (const [label, key] of names) {
  const got = Object.keys(countsFromPlan(ELECTRICAL_POINTS, [{ id: 'x', label, unit: 'COUNT', realValue: 1 }]));
  expect(`electrical "${label}" -> ${key}`, key ? got.length === 1 && got[0] === key : got.length === 0);
}
const plumbing: [string, string | null][] = [
  ['Shower screen', null], ['Toilet roll holder', null], ['Laundry door', null], ['Kitchen sink cabinet', null], ['Gas meter', null],
  ['Bath light', null], ['WC pan', 'wc'], ['Laundry trough', 'tub'], ['Gas cooktop', 'gas'], ['Basin mixer', 'basin'],
];
for (const [label, key] of plumbing) {
  const got = Object.keys(countsFromPlan(PLUMBING_FIXTURES, [{ id: 'x', label, unit: 'COUNT', realValue: 1 }]));
  expect(`plumbing "${label}" -> ${key}`, key ? got.length === 1 && got[0] === key : got.length === 0);
}
expect('70 m2 living too big for one split', roomLoads([{ name: 'Living', m2: 70 }])[0].tooBig);

if (failures) { console.log(`${failures} services failures`); process.exit(1); }
console.log('all services tests passed');
