import { pickSwing, swingOf, doorLeaf } from '@/lib/takeoff/doorSwing';
let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, JSON.stringify(got ?? '')); } };
// an 820 wide opening along x; on screen y grows downward, the normal (-dy, dx) points down
const a = { x: 0, y: 0 }, b = { x: 820, y: 0 };
const s1 = pickSwing(a, b, { x: 100, y: 300 });
expect('near start, below', s1.hinge === 'start' && s1.side === 1, s1);
const s2 = pickSwing(a, b, { x: 700, y: -300 });
expect('near end, above', s2.hinge === 'end' && s2.side === -1, s2);
const l1 = doorLeaf(a, b, s1);
expect('leaf hangs from the start jamb, below', l1.hinge === a && l1.jamb === b && l1.leaf.x === 0 && l1.leaf.y === 820, l1);
const l2 = doorLeaf(a, b, s2);
expect('leaf hangs from the end jamb, above', l2.hinge === b && l2.leaf.x === 820 && l2.leaf.y === -820, l2);
// doors saved before carry doorFlipped only: they draw exactly as they did
expect('old door', JSON.stringify(swingOf({})) === JSON.stringify({ hinge: 'start', side: 1 }));
expect('old flipped door', JSON.stringify(swingOf({ doorFlipped: true })) === JSON.stringify({ hinge: 'end', side: -1 }));
expect('new door wins', swingOf({ doorFlipped: true, doorHinge: 'start', doorSide: -1 }).side === -1);
if (failures) { console.log(`${failures} door swing failures`); process.exit(1); }
console.log('all door swing tests passed');
