import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface DetectedWall {
  id: string;
  worldPoints: { x: number; y: number }[];
  realValue: number;
  classification: 'external' | 'internal';
}

export interface DetectionResult {
  walls: DetectedWall[];
  tooMany: boolean;
  rawCount: number;
  method: 'vector' | 'pixel';
}

// ─── Affine matrix helpers [a, b, c, d, e, f]
// transform: x' = a*x + c*y + e, y' = b*x + d*y + f

function matMul(m1: number[], m2: number[]): number[] {
  return [
    m1[0]*m2[0] + m1[1]*m2[2],
    m1[0]*m2[1] + m1[1]*m2[3],
    m1[2]*m2[0] + m1[3]*m2[2],
    m1[2]*m2[1] + m1[3]*m2[3],
    m1[4]*m2[0] + m1[5]*m2[2] + m2[4],
    m1[4]*m2[1] + m1[5]*m2[3] + m2[5],
  ];
}

function applyMat(m: number[], x: number, y: number): [number, number] {
  return [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
}

interface Seg { x1: number; y1: number; x2: number; y2: number }

// ─── Vector path extraction from PDF operator list ─────────────────────────────
// Reads actual line objects the CAD system drew. No pixel noise.

async function extractVectorSegments(
  pdf: pdfjs.PDFDocumentProxy,
  pageIndex: number,
  minLengthWorld: number,
): Promise<Seg[]> {
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const vt = viewport.transform as number[];

  const opList = await page.getOperatorList();
  const { fnArray, argsArray } = opList;
  const OPS = pdfjs.OPS;

  // Graphics state stack
  interface GS { ctm: number[]; isDashed: boolean }
  const gsStack: GS[] = [];
  let gs: GS = { ctm: [1, 0, 0, 1, 0, 0], isDashed: false };

  // Current path
  let pathSegs: Seg[] = [];
  let curX = 0, curY = 0, startX = 0, startY = 0;
  let inPath = false;

  const worldSegs: Seg[] = [];

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const a = argsArray[i];

    switch (fn) {
      case OPS.save:
        gsStack.push({ ...gs, ctm: [...gs.ctm] });
        break;

      case OPS.restore:
        if (gsStack.length > 0) gs = gsStack.pop()!;
        break;

      case OPS.transform: {
        gs.ctm = matMul(gs.ctm, [a[0], a[1], a[2], a[3], a[4], a[5]]);
        break;
      }

      case OPS.setDash: {
        const dashArr = a[0];
        gs.isDashed = Array.isArray(dashArr) && dashArr.length > 0;
        break;
      }

      case OPS.moveTo: {
        // Apply CTM → then viewport transform → world space
        const [ux, uy] = applyMat(gs.ctm, a[0] as number, a[1] as number);
        const [wx, wy] = applyMat(vt, ux, uy);
        startX = wx; startY = wy; curX = wx; curY = wy;
        pathSegs = [];
        inPath = true;
        break;
      }

      case OPS.lineTo: {
        if (!inPath) break;
        const [ux, uy] = applyMat(gs.ctm, a[0] as number, a[1] as number);
        const [wx, wy] = applyMat(vt, ux, uy);
        pathSegs.push({ x1: curX, y1: curY, x2: wx, y2: wy });
        curX = wx; curY = wy;
        break;
      }

      case OPS.closePath: {
        if (inPath && (Math.abs(curX - startX) > 0.1 || Math.abs(curY - startY) > 0.1)) {
          pathSegs.push({ x1: curX, y1: curY, x2: startX, y2: startY });
          curX = startX; curY = startY;
        }
        break;
      }

      case OPS.stroke:
      case OPS.closeStroke: {
        if (fn === OPS.closeStroke && inPath &&
            (Math.abs(curX - startX) > 0.1 || Math.abs(curY - startY) > 0.1)) {
          pathSegs.push({ x1: curX, y1: curY, x2: startX, y2: startY });
        }
        if (!gs.isDashed) {
          for (const seg of pathSegs) worldSegs.push(seg);
        }
        pathSegs = []; inPath = false;
        break;
      }

      // Filled / discarded paths
      case OPS.endPath:
      case OPS.fill:
      case OPS.eoFill:
      case OPS.fillStroke:
      case OPS.eoFillStroke:
      case OPS.closeFillStroke:
      case OPS.closeEOFillStroke:
        pathSegs = []; inPath = false;
        break;
    }
  }

  // Filter: minimum length + near-axis only (walls are H or V in plan view)
  const ANGLE_TOL = 8; // degrees from horizontal/vertical
  const filtered: Seg[] = [];

  for (const seg of worldSegs) {
    const dx = Math.abs(seg.x2 - seg.x1);
    const dy = Math.abs(seg.y2 - seg.y1);
    const len = Math.hypot(dx, dy);
    if (len < minLengthWorld) continue;
    const deg = Math.atan2(dy, dx) * 180 / Math.PI; // 0=horizontal, 90=vertical
    if (deg > ANGLE_TOL && deg < 90 - ANGLE_TOL) continue; // diagonal — skip
    filtered.push(seg);
  }

  return filtered;
}

// ─── Merge colinear segments ───────────────────────────────────────────────────

function normalise(seg: Seg, horiz: boolean): Seg {
  if (horiz) return seg.x1 > seg.x2 ? { x1: seg.x2, y1: seg.y2, x2: seg.x1, y2: seg.y1 } : seg;
  return seg.y1 > seg.y2 ? { x1: seg.x2, y1: seg.y2, x2: seg.x1, y2: seg.y1 } : seg;
}

function mergeColinear(segs: Seg[], horiz: boolean, gapPt: number, posTol: number): Seg[] {
  if (!segs.length) return [];
  interface Group { pos: number; segs: Seg[] }
  const groups: Group[] = [];
  for (const seg of segs) {
    const pos = horiz ? (seg.y1 + seg.y2) / 2 : (seg.x1 + seg.x2) / 2;
    const g = groups.find(g => Math.abs(g.pos - pos) <= posTol);
    if (g) g.segs.push(seg); else groups.push({ pos, segs: [seg] });
  }
  const out: Seg[] = [];
  for (const { segs: gs } of groups) {
    gs.sort((a, b) => horiz ? a.x1 - b.x1 : a.y1 - b.y1);
    let cur = { ...gs[0] };
    for (let i = 1; i < gs.length; i++) {
      const gap = horiz ? gs[i].x1 - cur.x2 : gs[i].y1 - cur.y2;
      if (gap <= gapPt) {
        cur = horiz ? { ...cur, x2: Math.max(cur.x2, gs[i].x2) } : { ...cur, y2: Math.max(cur.y2, gs[i].y2) };
      } else { out.push(cur); cur = { ...gs[i] }; }
    }
    out.push(cur);
  }
  return out;
}

// ─── EXT / INT classification (perimeter = external) ──────────────────────────

function classifyByPerimeter(segs: Seg[]): ('external' | 'internal')[] {
  if (!segs.length) return [];
  const xs = segs.flatMap(s => [s.x1, s.x2]);
  const ys = segs.flatMap(s => [s.y1, s.y2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const tol = ((maxX - minX) + (maxY - minY)) * 0.07;
  return segs.map(s => {
    const cx = (s.x1 + s.x2) / 2, cy = (s.y1 + s.y2) / 2;
    return (cx < minX + tol || cx > maxX - tol || cy < minY + tol || cy > maxY - tol)
      ? 'external' : 'internal';
  });
}

// ─── Pixel fallback (for scanned PDFs with no vector data) ────────────────────

const PIXEL_SCALE = 2.0;

async function renderOffscreen(
  pdf: pdfjs.PDFDocumentProxy,
  pageIndex: number,
): Promise<{ canvas: HTMLCanvasElement; pxPerPt: number }> {
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: PIXEL_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d')! as unknown as CanvasRenderingContext2D, viewport }).promise;
  return { canvas, pxPerPt: PIXEL_SCALE };
}

function toGray(data: Uint8ClampedArray): Uint8Array {
  const g = new Uint8Array(data.length / 4);
  for (let i = 0; i < g.length; i++)
    g[i] = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
  return g;
}

function scanH(gray: Uint8Array, w: number, h: number, thr: number, minPx: number): Seg[] {
  const out: Seg[] = [];
  for (let y = 0; y < h; y++) {
    let s = -1;
    for (let x = 0; x <= w; x++) {
      const dark = x < w && gray[y*w+x] < thr;
      if (dark && s < 0) s = x;
      else if (!dark && s >= 0) { if (x - s >= minPx) out.push({ x1: s, y1: y, x2: x-1, y2: y }); s = -1; }
    }
  }
  return out;
}

function scanV(gray: Uint8Array, w: number, h: number, thr: number, minPx: number): Seg[] {
  const out: Seg[] = [];
  for (let x = 0; x < w; x++) {
    let s = -1;
    for (let y = 0; y <= h; y++) {
      const dark = y < h && gray[y*w+x] < thr;
      if (dark && s < 0) s = y;
      else if (!dark && s >= 0) { if (y - s >= minPx) out.push({ x1: x, y1: s, x2: x, y2: y-1 }); s = -1; }
    }
  }
  return out;
}

function thickness(gray: Uint8Array, w: number, h: number, seg: Seg, thr: number): number {
  const horiz = seg.y1 === seg.y2;
  const mx = Math.round((seg.x1+seg.x2)/2), my = Math.round((seg.y1+seg.y2)/2);
  let t = 1;
  if (horiz) {
    let y = my-1; while (y >= 0 && gray[y*w+mx] < thr) { t++; y--; }
    y = my+1; while (y < h && gray[y*w+mx] < thr) { t++; y++; }
  } else {
    let x = mx-1; while (x >= 0 && gray[my*w+x] < thr) { t++; x--; }
    x = mx+1; while (x < w && gray[my*w+x] < thr) { t++; x++; }
  }
  return t;
}

async function detectPixelFallback(
  pdf: pdfjs.PDFDocumentProxy,
  pageIndex: number,
  unitsPerMetre: number,
  maxSegs: number,
): Promise<DetectionResult> {
  const { canvas, pxPerPt } = await renderOffscreen(pdf, pageIndex);
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d')!;

  const marginX = Math.round(w * 0.04);
  const marginYTop = Math.round(h * 0.04);
  const marginYBot = Math.round(h * 0.15);
  const scanW = w - marginX * 2;
  const scanH = h - marginYTop - marginYBot;

  const { data } = ctx.getImageData(marginX, marginYTop, scanW, scanH);
  const gray = toGray(data);

  const THR = 80;
  const minPx = Math.max(6, Math.round(1.5 * unitsPerMetre * pxPerPt));

  const rawH = scanH(gray, scanW, scanH, THR, minPx);
  const rawV = scanV(gray, scanW, scanH, THR, minPx);
  const mH = mergeColinear(rawH.map(s => normalise(s, true)), true, 10, 2);
  const mV = mergeColinear(rawV.map(s => normalise(s, false)), false, 10, 2);
  const all = [
    ...mH.filter(s => thickness(gray, scanW, scanH, s, THR) >= 2),
    ...mV.filter(s => thickness(gray, scanW, scanH, s, THR) >= 2),
  ];

  const rawCount = all.length;
  if (rawCount > maxSegs) return { walls: [], tooMany: true, rawCount, method: 'pixel' };

  const classes = classifyByPerimeter(all);
  const walls: DetectedWall[] = all.map((seg, i) => {
    const wx1 = (seg.x1 + marginX) / pxPerPt;
    const wy1 = (seg.y1 + marginYTop) / pxPerPt;
    const wx2 = (seg.x2 + marginX) / pxPerPt;
    const wy2 = (seg.y2 + marginYTop) / pxPerPt;
    const realValue = Math.hypot(wx2-wx1, wy2-wy1) / unitsPerMetre;
    return { id: crypto.randomUUID(), worldPoints: [{ x: wx1, y: wy1 }, { x: wx2, y: wy2 }], realValue, classification: classes[i] };
  }).filter(w => w.realValue >= 1.5);

  return { walls, tooMany: false, rawCount: walls.length, method: 'pixel' };
}

// ─── Public API ───────────────────────────────────────────────────────────────

const MAX_VECTOR_SEGS = 60;
const MAX_PIXEL_SEGS = 25;
const MIN_WALL_METRES = 1.0; // for vector (cleaner data = can go lower)

export async function detectWallsFromPDF(
  pdfUrl: string,
  pageIndex: number,
  unitsPerMetre: number,
): Promise<DetectionResult> {
  const pdf = await pdfjs.getDocument(pdfUrl).promise;

  // Try vector extraction first
  const minLengthWorld = MIN_WALL_METRES * unitsPerMetre;
  const vectorSegs = await extractVectorSegments(pdf, pageIndex, minLengthWorld);

  if (vectorSegs.length > 0) {
    const hSegs = vectorSegs.filter(s => Math.abs(s.y2-s.y1) < Math.abs(s.x2-s.x1)).map(s => normalise(s, true));
    const vSegs = vectorSegs.filter(s => Math.abs(s.y2-s.y1) >= Math.abs(s.x2-s.x1)).map(s => normalise(s, false));
    // Tight merge: 4pt gap (~ 14cm at 1:100), 4pt position tolerance (handles both wall faces)
    const all = [
      ...mergeColinear(hSegs, true, 4, 4),
      ...mergeColinear(vSegs, false, 4, 4),
    ];

    const rawCount = all.length;
    if (rawCount > MAX_VECTOR_SEGS) return { walls: [], tooMany: true, rawCount, method: 'vector' };

    const classes = classifyByPerimeter(all);
    const walls: DetectedWall[] = all.map((seg, i) => ({
      id: crypto.randomUUID(),
      worldPoints: [{ x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 }],
      realValue: Math.hypot(seg.x2-seg.x1, seg.y2-seg.y1) / unitsPerMetre,
      classification: classes[i],
    })).filter(w => w.realValue >= MIN_WALL_METRES);

    return { walls, tooMany: false, rawCount: walls.length, method: 'vector' };
  }

  // Fallback: pixel-based detection for scanned plans
  return detectPixelFallback(pdf, pageIndex, unitsPerMetre, MAX_PIXEL_SEGS);
}
