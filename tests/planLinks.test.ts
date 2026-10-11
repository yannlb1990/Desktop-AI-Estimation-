/**
 * Plan-link rules: run with `node tests/run.mjs`
 */
import { applyMeasurements, createPlanLink, relinkWithQuantity, remapMeasurementIds, lineSource } from '../src/lib/estimate/planLinks';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`}`);
};

const wall = (id: string, len: number, height = 2.7): any =>
  ({ id, type: 'wall-line', unit: 'LM', realValue: len, height, measurementType: 'Wall', pageIndex: 0 });
const floor = (id: string, m2: number): any => ({ id, type: 'polygon', unit: 'M2', realValue: m2, pageIndex: 0 });

// Plasterboard both faces of wall W1 (10 m x 2.7 = 27 m²) → 54 m², factor 2
const W1 = wall('W1', 10);
const link = createPlanLink(['W1'], 54, [W1]);
eq('factor captured from current qty', [link.factor, link.baseQty], [2, 27]);

const item = { id: 'L1', quantity: 54, labour_hours: 10.8, plan_link: link };

// 1. Re-measure W1 to 12 m → 12 x 2.7 x 2 = 64.8
{
  const r = applyMeasurements([item], [wall('W1', 12)], 'T');
  eq('re-measure updates qty', r.items[0].quantity, 64.8);
  eq('labour scales with qty', r.items[0].labour_hours, 12.96);
  eq('change marker keeps original', r.items[0].plan_link?.changedFrom, 54);
}

// 2. Drawing ANOTHER wall must not touch the existing line
{
  const r = applyMeasurements([item], [W1, wall('W2', 8)]);
  eq('new wall does not change line', [r.items[0].quantity, r.changes.length], [54, 0]);
  eq('unchanged line keeps same object', r.items[0] === item, true);
}

// 3. Wall height change counts (effective qty is m²)
{
  const r = applyMeasurements([item], [wall('W1', 10, 3)]);
  eq('height change updates', r.items[0].quantity, 60);
}

// 4. Delete one of two linked measurements → only remaining counts
{
  const two = { id: 'L2', quantity: 50, plan_link: createPlanLink(['F1', 'F2'], 50, [floor('F1', 20), floor('F2', 30)]) };
  const r = applyMeasurements([two], [floor('F1', 20)]);
  eq('partial delete reduces qty', r.items[0].quantity, 20);
}

// 5. Delete all linked measurements → quantity kept, flagged broken
{
  const r = applyMeasurements([item], []);
  eq('all deleted: qty kept', r.items[0].quantity, 54);
  eq('all deleted: flagged broken', r.items[0].plan_link?.broken, true);
  const again = applyMeasurements(r.items, []);
  eq('broken reported once', again.changes.length, 0);
}

// 6. User overrides qty on a linked line → new ratio stays live
{
  const edited = { ...item, quantity: 60, plan_link: relinkWithQuantity(link, 60) };
  const r = applyMeasurements([edited], [wall('W1', 20)]); // 54 m² base → 60/27 x 54 = 120
  eq('override keeps new ratio', r.items[0].quantity, 120);
}

// 7. Combine W1 (line A, 54) + W2 (line B, 8 m x 2.7 = 21.6) into W3 (18 m)
{
  const lineB = { id: 'L7', quantity: 21.6, plan_link: createPlanLink(['W2'], 21.6, [wall('W2', 8)]) };
  const W3 = wall('W3', 18);
  const remapped = remapMeasurementIds([item, lineB], ['W1', 'W2'], W3, [W3]);
  eq('remap ids', remapped.map(i => i.plan_link?.measurementIds), [['W3'], ['W3']]);
  eq('combine keeps both qtys (no double count)', remapped.map(i => i.quantity), [54, 21.6]);
  const r = applyMeasurements(remapped, [W3]);
  eq('no change right after combine', r.changes.length, 0);
  const grown = applyMeasurements(remapped, [wall('W3', 36)]);
  eq('combined doubled: both lines double', grown.items.map(i => i.quantity), [108, 43.2]);
}

// 8. Unlinked lines are never touched
{
  const manual = { id: 'M', quantity: 7 };
  const r = applyMeasurements([manual], [W1]);
  eq('manual untouched', r.items[0] === manual, true);
  eq('source manual', lineSource(manual), 'manual');
  eq('source plan', lineSource(item), 'plan');
  eq('source ai', lineSource({ source: 'ai' }), 'ai');
}

// 9. Count measurement (doors): 4 doors → 5
{
  const doors: any = { id: 'D', type: 'count', unit: 'count', realValue: 4, pageIndex: 0 };
  const l = { id: 'DL', quantity: 4, plan_link: createPlanLink(['D'], 4, [doors]) };
  const r = applyMeasurements([l], [{ ...doors, realValue: 5 }]);
  eq('count updates', r.items[0].quantity, 5);
}

// 10. Metre line on a wall follows its LENGTH: height change must not move it
{
  const sk = { id: 'SK', quantity: 10, unit: 'LM', plan_link: createPlanLink(['W1'], 10, [W1], 'LM') };
  eq('LM line factor on wall length', sk.plan_link.factor, 1);
  const taller = applyMeasurements([sk], [wall('W1', 10, 3.2)]);
  eq('height change leaves LM line', [taller.items[0].quantity, taller.changes.length], [10, 0]);
  const longer = applyMeasurements([sk], [wall('W1', 12)]);
  eq('length change moves LM line', longer.items[0].quantity, 12);
}

// 11. m² line on a concrete slab follows area, m³ line follows volume
{
  const slab: any = { id: 'S', type: 'polygon', unit: 'M2', realValue: 100, measurementType: 'Floor', isConcreteFloor: true, concreteDepth: 0.1, pageIndex: 0 };
  const mesh = { id: 'MESH', quantity: 100, unit: 'M2', plan_link: createPlanLink(['S'], 100, [slab], 'M2') };
  const conc = { id: 'CONC', quantity: 10, unit: 'm³', plan_link: createPlanLink(['S'], 10, [slab], 'm³') };
  const r = applyMeasurements([mesh, conc], [{ ...slab, concreteDepth: 0.12 }]);
  eq('depth change: mesh stays, concrete grows', r.items.map(i => i.quantity), [100, 12]);
}

// 12. Old link (no v) is re-based once without changing its quantity
{
  const old = { id: 'OLD', quantity: 18, unit: 'LM', plan_link: { measurementIds: ['W1'], factor: 18 / 27, baseQty: 27 } };
  const r = applyMeasurements([old], [W1]);
  eq('old link rebased, qty kept', [r.items[0].quantity, r.items[0].plan_link?.baseQty, r.items[0].plan_link?.v, r.changes.length], [18, 10, 2, 0]);
}

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nall plan-link tests passed');
