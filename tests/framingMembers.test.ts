import { framingMembersForWall } from '../src/lib/takeoff/framingMembers';
import { applyMeasurements, createPlanLink } from '../src/lib/estimate/planLinks';
let failed = 0;
const eq = (n: string, g: unknown, w: unknown) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ` got ${JSON.stringify(g)} want ${JSON.stringify(w)}`}`); };
const f = framingMembersForWall(6.1, 2.4, 450)!;
eq('6.1 m wall @450: studs', f.studs, 15);              // ceil(6100/450)=14 +1
eq('stud length = wall height', f.studLengthM, 2.4);
eq('plates bottom + double top', f.plateLM, 18.3);
eq('one nogging row under 2.7 m', [f.noggingRows, f.noggingLM], [1, 6.1]);
eq('two rows over 2.7 m', framingMembersForWall(6.1, 3.0, 600)!.noggingRows, 2);
eq('no height: no suggestion', framingMembersForWall(6.1, 0), null);
// Stud count line linked to the wall follows its length, not its height
const wall: any = { id: 'W', unit: 'LM', realValue: 6.1, height: 2.4, measurementType: 'Wall', pageIndex: 0 };
const studs = { id: 'S', quantity: 15, unit: 'count', plan_link: createPlanLink(['W'], 15, [wall], 'count') };
eq('height change keeps stud count', applyMeasurements([studs], [{ ...wall, height: 2.7 }]).items[0].quantity, 15);
eq('double length doubles studs', applyMeasurements([studs], [{ ...wall, realValue: 12.2 }]).items[0].quantity, 30);
// Concrete slab volume
import { getEffectiveQuantity } from '../src/lib/takeoff/calculations';
eq('slab 8.66 m² at 100 mm', Math.round(getEffectiveQuantity({ id: 'C', unit: 'M2', realValue: 8.66, measurementType: 'Concrete Slab', concreteDepth: 0.1 } as any) * 1000) / 1000, 0.866);
eq('imported floor in m² with concrete', Math.round(getEffectiveQuantity({ id: 'F', unit: 'm²', realValue: 10, measurementType: 'Floor', isConcreteFloor: true, concreteDepth: 0.1 } as any) * 1000) / 1000, 1);
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log('all framing tests passed');
