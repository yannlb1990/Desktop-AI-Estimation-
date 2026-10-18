import { wallLines, wallMembers, legacyWallBuild, openingsArea, type WallBuild } from '@/lib/takeoff/wallItems';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };
const near = (a: number, b: number) => Math.abs(a - b) < 0.011;
const base: WallBuild = { framingSystem: 'timber_90_mgp10', faceA: 'pb_10', faceB: 'pb_10', layers: 1, insulationType: 'r2_batts',
  doors: 0, windows: 0, doorWidthM: 0.82, doorHeightM: 2.04, windowWidthM: 1.2, windowHeightM: 1.2, paint: false, skirting: false, cornice: false };
const get = (ls: any[], key: string) => ls.find(l => l.key === key);

// Yann's wall: 119.78 m at 2.4 m
let ls = wallLines(119.78, 2.4, base);
expect('framing gross 287.47', near(get(ls, 'framing').qty, 287.47));
expect('PB both faces is 2x area', near(get(ls, 'lining').qty, 574.94));
expect('batts one layer', near(get(ls, 'insulation').qty, 287.47));

// Openings come off linings and batts, not framing
const withOpenings = { ...base, doors: 3, windows: 4 };
const open = 3 * 0.82 * 2.04 + 4 * 1.44;
expect('openings area', near(openingsArea(withOpenings), open));
ls = wallLines(10, 2.4, withOpenings);
expect('framing keeps gross', near(get(ls, 'framing').qty, 24));
expect('lining net both faces', near(get(ls, 'lining').qty, (24 - open) * 2));
expect('batts net', near(get(ls, 'insulation').qty, 24 - open));

// Brick veneer: PB inside, brick outside with bricks and ties, no paint or trim on the brick face
const veneer: WallBuild = { ...base, faceB: 'brick', insulationType: 'r25_batts', paint: true, skirting: true, cornice: true };
ls = wallLines(10, 2.4, veneer);
expect('veneer lining one face', near(get(ls, 'lining-a').qty, 24) && !get(ls, 'lining'));
expect('brick veneer line', near(get(ls, 'cladding-b').qty, 24) && get(ls, 'cladding-b').trade === 'Bricklayer');
expect('brick count ~1162', /1162 bricks/.test(get(ls, 'cladding-b').material));
expect('paint only the PB face', near(get(ls, 'paint').qty, 24));
expect('skirting one face', near(get(ls, 'skirting').qty, 10));

// External: PB inside, FC cladding outside (old preset wrongly put FC on both faces)
ls = wallLines(10, 2.4, { ...base, faceB: 'fc_ext' });
expect('external has PB inside', get(ls, 'lining-a').rateId === 'plas-002');
expect('external has FC cladding outside', get(ls, 'cladding-b').rateId === 'clad-002');

// Fire-rated: 2 layers each face
ls = wallLines(10, 2.4, { ...base, faceA: 'fc_9', faceB: 'fc_9', layers: 2 });
expect('fire rated 4 sheets of area', near(get(ls, 'lining').qty, 96));

// Skirting stops at doorways on both faces
ls = wallLines(10, 2.4, { ...base, doors: 2, skirting: true });
expect('skirting less doorways', near(get(ls, 'skirting').qty, 20 - 2 * 0.82 * 2));

// Members: jamb studs and lintels per opening
const mem = wallMembers(6.1, 2.4, 450, { ...base, doors: 1, windows: 1 })!;
expect('15 studs on 6.1 m', mem.studs === 15);
expect('4 jamb studs', mem.jambStuds === 4);
expect('lintels 1.12 + 1.5', near(mem.lintelLM, 2.62));

// Walls saved before v2 keep their meaning
const legacy = legacyWallBuild({ framingSystem: 'timber_90_mgp10', hasLining: true, liningType: 'pb_10', liningFaces: 2, hasInsulation: true, insulationType: 'r2_batts' });
expect('legacy 2 faces', legacy.faceA === 'pb_10' && legacy.faceB === 'pb_10');
expect('legacy 1 face', legacyWallBuild({ hasLining: true, liningType: 'pb_10', liningFaces: 1 }).faceB === 'none');

// Two different linings on one wall must have different names (takeoff dedupes by name + unit per wall)
ls = wallLines(10, 2.4, { ...base, faceA: 'pb_10', faceB: 'fc_6' });
expect('distinct face names', new Set(ls.map(l => l.name + l.unit)).size === ls.length);
for (const f of ['fc_ext', 'weatherboard', 'brick', 'none'] as const) {
  const x = wallLines(10, 2.4, { ...base, faceB: f, paint: true, skirting: true, cornice: true });
  expect(`unique names with ${f}`, new Set(x.map(l => l.name + l.unit)).size === x.length);
}

if (failures) { console.log(`${failures} wall item failures`); process.exit(1); }
console.log('all wall item tests passed');
