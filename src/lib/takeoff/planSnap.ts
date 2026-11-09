/**
 * Snapping to the plan's own lines. A PDF exported from CAD or drafting software holds its
 * walls as real lines; reading them lets a Pencil or mouse point land exactly on a corner,
 * an intersection or along a wall instead of where the hand put it. Scanned plans have no
 * lines (only a picture), so nothing is found and snapping stays on the user's own points.
 *
 * Coordinates are the takeoff's world space: the page at scale 1 with the view's rotation.
 */
export interface PlanSeg { x1: number; y1: number; x2: number; y2: number }
export interface PlanSnapIndex {
  segs: PlanSeg[];
  cell: number;
  grid: Map<string, number[]>;
}
export interface PlanSnap { point: { x: number; y: number }; kind: 'corner' | 'intersection' | 'line' }

const MAX_SEGS = 150_000;
// pdf.js 5 packs a shape's path into one constructPath command using these codes
const D_MOVE = 0, D_LINE = 1, D_CURVE = 2, D_QUAD = 3, D_CLOSE = 4;

const mul = (m1: number[], m2: number[]) => [
  m1[0] * m2[0] + m1[1] * m2[2], m1[0] * m2[1] + m1[1] * m2[3],
  m1[2] * m2[0] + m1[3] * m2[2], m1[2] * m2[1] + m1[3] * m2[3],
  m1[4] * m2[0] + m1[5] * m2[2] + m2[4], m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
];
const apply = (m: number[], x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Every straight line drawn on the page (curves become their chord), in world space. */
export async function extractPlanSegments(page: any, rotation = 0): Promise<PlanSeg[]> {
  const vt = page.getViewport({ scale: 1, rotation }).transform as number[];
  const opList = await page.getOperatorList({ intent: 'any' });
  const { fnArray, argsArray } = opList;
  // loaded here so the snapping maths can be tested without a browser
  const OPS = ((await import('pdfjs-dist')) as any).OPS;
  const out: PlanSeg[] = [];
  const stack: number[][] = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const push = (ax: number, ay: number, bx: number, by: number) => {
    if (out.length >= MAX_SEGS) return;
    const [ux1, uy1] = apply(ctm, ax, ay);
    const [ux2, uy2] = apply(ctm, bx, by);
    const [x1, y1] = apply(vt, ux1, uy1);
    const [x2, y2] = apply(vt, ux2, uy2);
    if (Math.hypot(x2 - x1, y2 - y1) < 0.5) return; // dust: hatching dots, tiny ticks
    out.push({ x1, y1, x2, y2 });
  };
  // older style operators (moveTo / lineTo one by one)
  let cx = 0, cy = 0, sx = 0, sy = 0;

  for (let i = 0; i < fnArray.length && out.length < MAX_SEGS; i++) {
    const fn = fnArray[i];
    const a = argsArray[i];
    if (fn === OPS.save) stack.push([...ctm]);
    else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop()!; }
    else if (fn === OPS.transform) ctm = mul([a[0], a[1], a[2], a[3], a[4], a[5]], ctm);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push([...ctm]);
      const m = a?.[0];
      if (Array.isArray(m) || ArrayBuffer.isView(m)) ctm = mul(Array.from(m as ArrayLike<number>), ctm);
    } else if (fn === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop()!; }
    else if (fn === OPS.constructPath) {
      // pdf.js 5: [op, [pathData], minMax]; older: [ops[], coords[], minMax]
      const data = Array.isArray(a?.[1]) ? a[1][0] : null;
      if (data && typeof data.length === 'number' && !(data instanceof Path2D)) {
        let px = 0, py = 0, qx = 0, qy = 0;
        for (let k = 0; k < data.length;) {
          const op = data[k++];
          if (op === D_MOVE) { px = data[k++]; py = data[k++]; qx = px; qy = py; }
          else if (op === D_LINE) { const x = data[k++], y = data[k++]; push(px, py, x, y); px = x; py = y; }
          else if (op === D_CURVE) { k += 4; const x = data[k++], y = data[k++]; push(px, py, x, y); px = x; py = y; }
          else if (op === D_QUAD) { k += 2; const x = data[k++], y = data[k++]; push(px, py, x, y); px = x; py = y; }
          else if (op === D_CLOSE) { push(px, py, qx, qy); px = qx; py = qy; }
          else break;
        }
      } else if (Array.isArray(a?.[0]) && Array.isArray(a?.[1])) {
        const ops: number[] = a[0], coords: number[] = a[1];
        let j = 0;
        for (const op of ops) {
          if (op === OPS.moveTo) { cx = coords[j++]; cy = coords[j++]; sx = cx; sy = cy; }
          else if (op === OPS.lineTo) { const x = coords[j++], y = coords[j++]; push(cx, cy, x, y); cx = x; cy = y; }
          else if (op === OPS.curveTo) { j += 4; const x = coords[j++], y = coords[j++]; push(cx, cy, x, y); cx = x; cy = y; }
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) { j += 2; const x = coords[j++], y = coords[j++]; push(cx, cy, x, y); cx = x; cy = y; }
          else if (op === OPS.rectangle) {
            const x = coords[j++], y = coords[j++], w = coords[j++], h = coords[j++];
            push(x, y, x + w, y); push(x + w, y, x + w, y + h); push(x + w, y + h, x, y + h); push(x, y + h, x, y);
          } else if (op === OPS.closePath) { push(cx, cy, sx, sy); cx = sx; cy = sy; }
        }
      }
    }
  }
  return out;
}

export function buildPlanIndex(segs: PlanSeg[], cell = 40): PlanSnapIndex {
  const grid = new Map<string, number[]>();
  segs.forEach((s, idx) => {
    const minX = Math.floor(Math.min(s.x1, s.x2) / cell), maxX = Math.floor(Math.max(s.x1, s.x2) / cell);
    const minY = Math.floor(Math.min(s.y1, s.y2) / cell), maxY = Math.floor(Math.max(s.y1, s.y2) / cell);
    // long lines touch many cells; cap the spread so one border line can't fill the grid
    if ((maxX - minX + 1) * (maxY - minY + 1) > 400) {
      for (const [gx, gy] of [[minX, minY], [maxX, maxY]]) { const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(idx); }
      return;
    }
    for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
      const k = `${gx},${gy}`;
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(idx);
    }
  });
  return { segs, cell, grid };
}

function nearby(index: PlanSnapIndex, x: number, y: number, r: number): PlanSeg[] {
  const c = index.cell;
  const seen = new Set<number>();
  for (let gx = Math.floor((x - r) / c); gx <= Math.floor((x + r) / c); gx++)
    for (let gy = Math.floor((y - r) / c); gy <= Math.floor((y + r) / c); gy++)
      for (const i of index.grid.get(`${gx},${gy}`) ?? []) seen.add(i);
  return [...seen].slice(0, 400).map(i => index.segs[i]);
}

function project(s: PlanSeg, x: number, y: number) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / len2));
  return { x: s.x1 + t * dx, y: s.y1 + t * dy };
}

function intersect(a: PlanSeg, b: PlanSeg) {
  const d = (a.x2 - a.x1) * (b.y2 - b.y1) - (a.y2 - a.y1) * (b.x2 - b.x1);
  if (Math.abs(d) < 1e-9) return null; // parallel
  const t = ((b.x1 - a.x1) * (b.y2 - b.y1) - (b.y1 - a.y1) * (b.x2 - b.x1)) / d;
  const u = ((b.x1 - a.x1) * (a.y2 - a.y1) - (b.y1 - a.y1) * (a.x2 - a.x1)) / d;
  if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null;
  return { x: a.x1 + t * (a.x2 - a.x1), y: a.y1 + t * (a.y2 - a.y1) };
}

/**
 * The plan point to snap to within r (world units): a line end or corner first, then where
 * two lines cross, then the nearest point along a line (a little closer in).
 */
export function snapToPlan(index: PlanSnapIndex | null, x: number, y: number, r: number): PlanSnap | null {
  if (!index || !index.segs.length || !(r > 0)) return null;
  const segs = nearby(index, x, y, r);
  if (!segs.length) return null;
  let best: PlanSnap | null = null, bestD = r;
  for (const s of segs) for (const p of [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { bestD = d; best = { point: p, kind: 'corner' }; }
  }
  if (best) return best;
  const close = segs.filter(s => { const p = project(s, x, y); return Math.hypot(p.x - x, p.y - y) < r; }).slice(0, 60);
  for (let i = 0; i < close.length; i++) for (let j = i + 1; j < close.length; j++) {
    const p = intersect(close[i], close[j]);
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { bestD = d; best = { point: p, kind: 'intersection' }; }
  }
  if (best) return best;
  let lineD = r * 0.7;
  for (const s of close) {
    const p = project(s, x, y);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < lineD) { lineD = d; best = { point: p, kind: 'line' }; }
  }
  return best;
}
