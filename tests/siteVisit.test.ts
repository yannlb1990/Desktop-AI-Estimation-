import { roomQuantities, scopeQuantity, SCOPE_BY_ROOM, newRoom, mergeVisits, newVisit } from '@/lib/site/visit';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };

// 2.4 x 1.8 bathroom, 2.4 high
const q = roomQuantities({ lengthM: 2.4, widthM: 1.8, heightM: 2.4 });
expect('floor 4.32', q.floor === 4.32 && q.ceiling === 4.32);
expect('perimeter 8.4', q.perimeter === 8.4);
expect('walls 20.16', q.walls === 20.16);
const tile = SCOPE_BY_ROOM.bathroom.find(o => o.key === 'tile_walls')!;
expect('wall tiles from wall area', scopeQuantity(tile, q) === 20.16);
const vanity = SCOPE_BY_ROOM.bathroom.find(o => o.key === 'vanity')!;
expect('vanity counted as 1', scopeQuantity(vanity, q) === 1);
expect('missing sizes give 0, not NaN', roomQuantities({ lengthM: null, widthM: 3, heightM: 2.4 }).walls === 0);

// Room naming
const r1 = newRoom('bedroom', []);
const r2 = newRoom('bedroom', [r1]);
expect('second bedroom named Bedroom 2', r2.name === 'Bedroom 2' && r1.name === 'Bedroom');
expect('deck has no height', newRoom('outdoor', []).heightM === null);
// every checklist key unique within a room type
for (const [t, list] of Object.entries(SCOPE_BY_ROOM)) expect(`unique keys ${t}`, new Set(list.map(o => o.key)).size === list.length);

// Merge: newer copy wins, but a photo uploaded by the other copy keeps its path
const v = newVisit();
const room = { ...newRoom('kitchen', []), photos: [{ id: 'p1', caption: '', takenAt: 'x' }] };
const phone = { ...v, rooms: [room], updatedAt: '2026-10-24T10:00:00Z', notes: 'phone' };
const cloud = { ...v, rooms: [{ ...room, photos: [{ id: 'p1', caption: '', takenAt: 'x', path: 'uid/v/p1.jpg' }] }], updatedAt: '2026-10-24T09:00:00Z', notes: 'cloud' };
const m = mergeVisits(phone, cloud);
expect('newer notes kept', m.notes === 'phone');
expect('uploaded path kept', m.rooms[0].photos[0].path === 'uid/v/p1.jpg');

if (failures) { console.log(`${failures} site visit failures`); process.exit(1); }
console.log('all site visit tests passed');
