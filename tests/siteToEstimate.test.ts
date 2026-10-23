import { draftLinesFromVisit, siteScopeText } from '@/lib/site/toEstimate';
import { newVisit, newRoom } from '@/lib/site/visit';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };

const v = newVisit();
const bath = { ...newRoom('bathroom', []), lengthM: 2.4, widthM: 1.8, heightM: 2.4, scope: ['waterproof', 'tile_walls', 'vanity', 'not_a_key'], notes: 'Old tiles drummy, check subfloor' };
const bed = { ...newRoom('bedroom', []), scope: ['floor_bed'] };
const visit = { ...v, notes: 'Pre-1980 house: test for asbestos', rooms: [bath, bed] };
const lines = draftLinesFromVisit(visit);
expect('3 lines (unknown key ignored) + 1 bedroom', lines.length === 4);
const wp = lines.find(l => l.scope.startsWith('Waterproofing'))!;
expect('waterproofing from floor 4.32', wp.quantity === 4.32 && wp.unit === 'm²' && wp.trade === 'Waterproofer');
expect('wall tiles from walls 20.16', lines.find(l => l.scope === 'Tile walls')!.quantity === 20.16);
expect('vanity count 1', lines.find(l => l.scope === 'Vanity and basin')!.quantity === 1);
const floor = lines.find(l => l.roomName === 'Bedroom')!;
expect('bedroom with no sizes flagged', floor.needsQuantity && floor.quantity === 0);
expect('stable keys', new Set(lines.map(l => l.key)).size === lines.length && lines[0].key.startsWith(visit.id));
expect('again gives same keys', draftLinesFromVisit(visit).map(l => l.key).join() === lines.map(l => l.key).join());
const text = siteScopeText(visit);
expect('scope text has notes and rooms', /asbestos/.test(text) && /Bathroom \(2.4 x 1.8 m, 2.4 m high\): Waterproofing/.test(text) && /drummy/.test(text));

if (failures) { console.log(`${failures} site to estimate failures`); process.exit(1); }
console.log('all site to estimate tests passed');
