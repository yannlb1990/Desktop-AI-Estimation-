import { mergeWithSaved } from '../src/lib/estimate/mergeSaved';
let failed = 0;
const eq = (n: string, g: unknown, w: unknown) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ` got ${JSON.stringify(g)} want ${JSON.stringify(w)}`}`); };
const a = { id: 'a', q: 1 }, b = { id: 'b', q: 2 }, c = { id: 'c', q: 3 };
const loaded = [a, b, c];
// Takeoff added line T and updated b's quantity after the screen loaded
const saved = [a, { id: 'b', q: 20 }, c, { id: 'T', q: 9 }];
eq('delete c keeps arrived T and newer b', mergeWithSaved(saved, loaded, [a, b]), [a, { id: 'b', q: 20 }, { id: 'T', q: 9 }]);
const a2 = { id: 'a', q: 5 };
eq('edit a wins, b newer kept, T kept', mergeWithSaved(saved, loaded, [a2, b, c]), [a2, { id: 'b', q: 20 }, c, { id: 'T', q: 9 }]);
const n = { id: 'n', q: 1 };
eq('add n keeps T', mergeWithSaved(saved, loaded, [a, b, c, n]).map(i => i.id), ['a', 'b', 'c', 'n', 'T']);
eq('nothing saved: updated as is', mergeWithSaved(undefined, loaded, [a]), [a]);
eq('deleted line not resurrected', mergeWithSaved([a, b, c], loaded, [a, b]).map(i => i.id), ['a', 'b']);
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log('all merge tests passed');
