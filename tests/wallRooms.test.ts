import { findWallRooms } from '@/lib/takeoff/wallRooms';

let failures = 0;
const expect = (name: string, ok: boolean, got?: unknown) => { if (!ok) { failures++; console.log('FAIL', name, got ?? ''); } };
const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;
const U = 50; // plan units per metre
let n = 0;
const wall = (pts: [number, number][], thk = 90): any => ({
  id: `w${++n}`, type: 'line', wallThickness: thk, pageIndex: 0, unit: 'm', realValue: 0,
  worldPoints: pts.map(([x, y]) => ({ x: x * U, y: y * U })),
});

// 4 x 3 m room, 90 mm walls drawn as four separate walls
const box = [wall([[0, 0], [4, 0]]), wall([[4, 0], [4, 3]]), wall([[4, 3], [0, 3]]), wall([[0, 3], [0, 0]])];
let r = findWallRooms(box, U);
expect('one room', r.length === 1, r.length);
expect('gross 12', near(r[0]?.grossAreaM2, 12), r[0]?.grossAreaM2);
expect('net inside faces', near(r[0]?.netAreaM2, 3.91 * 2.91), r[0]?.netAreaM2);
expect('inside perimeter', near(r[0]?.perimeterM, 2 * (3.91 + 2.91)), r[0]?.perimeterM);

// same walls drawn the other way round and as one chain
r = findWallRooms([wall([[0, 0], [0, 3], [4, 3], [4, 0], [0, 0]])], U);
expect('chain, reversed: same room', r.length === 1 && near(r[0].netAreaM2, 3.91 * 2.91), r[0]?.netAreaM2);

// divided by an internal 90 mm wall (T junctions), external 110 mm
const ext = [wall([[0, 0], [4, 0]], 110), wall([[4, 0], [4, 3]], 110), wall([[4, 3], [0, 3]], 110), wall([[0, 3], [0, 0]], 110)];
r = findWallRooms([...ext, wall([[2, 0], [2, 3]], 90)], U);
expect('two rooms', r.length === 2, r.length);
expect('each net (2 - 0.055 - 0.045) x (3 - 0.11)', r.every(x => near(x.netAreaM2, 1.9 * 2.89)), r.map(x => x.netAreaM2));
expect('keys differ', r.length === 2 && r[0].key !== r[1].key);

// open on one side: no room
r = findWallRooms([wall([[0, 0], [4, 0]]), wall([[4, 0], [4, 3]]), wall([[4, 3], [0, 3]])], U);
expect('open shape: none', r.length === 0, r.length);

// a stub sticking into the room changes nothing
r = findWallRooms([...box, wall([[4, 1.5], [3, 1.5]])], U);
expect('stub ignored', r.length === 1 && near(r[0].grossAreaM2, 12), r.map(x => x.grossAreaM2));

// ends a few cm apart still join
r = findWallRooms([wall([[0, 0], [4, 0]]), wall([[4.04, 0.03], [4, 3]]), wall([[4, 3], [0, 3]]), wall([[0, 3], [0, 0.05]])], U);
expect('small gaps join', r.length === 1, r.length);

// L-shaped room
r = findWallRooms([wall([[0, 0], [6, 0], [6, 2], [3, 2], [3, 5], [0, 5], [0, 0]])], U);
expect('L shape gross 21', r.length === 1 && near(r[0].grossAreaM2, 21), r[0]?.grossAreaM2);

// two walls crossing through a box make four rooms
r = findWallRooms([...box, wall([[2, 0], [2, 3]]), wall([[0, 1.5], [4, 1.5]])], U);
expect('cross: four rooms', r.length === 4, r.length);

// review cases
// near-straight join of a 110 and a 90 mm wall: no spike
r = findWallRooms([wall([[0, 0], [2, 0]], 110), wall([[2, 0], [4, 0.0000087]], 90), wall([[4, 0.0000087], [4, 3]]), wall([[4, 3], [0, 3]]), wall([[0, 3], [0, 0]])], U);
expect('near-straight join sane', r.length === 1 && r[0].perimeterM < 14 && r[0].netAreaM2 > 11.3 && r[0].netAreaM2 < 11.45, r.map(x => [x.netAreaM2, x.perimeterM]));
// free-standing 2 x 2 box inside a 6 x 6 room comes off
r = findWallRooms([wall([[0, 0], [6, 0], [6, 6], [0, 6], [0, 0]]), wall([[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]])], U);
const big = r.find(x => x.grossAreaM2 > 20);
expect('island off gross', !!big && near(big.grossAreaM2, 32), big?.grossAreaM2);
expect('island off net', !!big && near(big.netAreaM2, 5.91 * 5.91 - 2.09 * 2.09), big?.netAreaM2);
// internal wall stopping at the face of a 230 mm wall still splits the room
r = findWallRooms([wall([[0, 0], [4, 0]], 230), wall([[4, 0], [4, 3]], 230), wall([[4, 3], [0, 3]], 230), wall([[0, 3], [0, 0]], 230), wall([[2, 0.115], [2, 2.885]], 90)], U);
expect('T at a thick wall face joins', r.length === 2, r.length);
// a wall re-marked as a door is not a wall
const doorish = wall([[0, 3], [0, 0]]); doorish.measurementType = 'Door';
{ const { wallsForRooms } = await import('@/lib/takeoff/wallRooms'); expect('door not a wall', wallsForRooms([box[0], box[1], box[2], doorish], 0).length === 3); }

if (failures) { console.log(`${failures} wall room failures`); process.exit(1); }
console.log('all wall room tests passed');
