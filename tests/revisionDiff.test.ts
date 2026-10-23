// Pure mask maths only (rendering needs a browser)
import { inkMask, dilate, diffMasks } from '@/lib/takeoff/revisionMask';

let failures = 0;
const expect = (name: string, ok: boolean) => { if (!ok) { failures++; console.log('FAIL', name); } };
const W = 40, H = 20;
const blank = () => new Uint8Array(W * H);
const line = (m: Uint8Array, y: number, x0: number, x1: number) => { for (let x = x0; x <= x1; x++) m[y * W + x] = 1; };

// Same wall, drawn 1 px lower in the new revision: not a change
let oldM = blank(), newM = blank();
line(oldM, 5, 2, 30); line(newM, 6, 2, 30);
let d = diffMasks(oldM, newM, W, H, 2);
expect('1 px shift is not a change', d.added === 0 && d.removed === 0);

// A wall removed and a new one added elsewhere
oldM = blank(); newM = blank();
line(oldM, 5, 2, 30); line(newM, 5, 2, 30);
line(oldM, 15, 2, 10);          // removed
line(newM, 12, 20, 35);         // added
d = diffMasks(oldM, newM, W, H, 2);
expect('removed wall 9 px red', d.removed === 9);
expect('added wall 16 px green', d.added === 16);
expect('overlay green where added', d.overlay[(12 * W + 25) * 4 + 1] === 170);
expect('overlay red where removed', d.overlay[(15 * W + 5) * 4] === 225);
expect('unchanged wall transparent', d.overlay[(5 * W + 10) * 4 + 3] === 0);

// ink mask: dark pixels only
const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 120, 120, 120, 255, 0, 0, 0, 0]);
const ink = inkMask(rgba, 4, 1);
expect('ink mask', ink[0] === 1 && ink[1] === 0 && ink[2] === 1 && ink[3] === 0);

// dilate radius 1 around a point
const p = new Uint8Array(25); p[12] = 1;
const g = dilate(p, 5, 5, 1);
expect('dilate 3x3', g.reduce((s, v) => s + v, 0) === 9 && g[6] === 1 && g[18] === 1 && g[0] === 0);

if (failures) { console.log(`${failures} revision diff failures`); process.exit(1); }
console.log('all revision diff tests passed');
