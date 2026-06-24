import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const DETECTION_SCALE = 2.0;

export interface DetectedWall {
  id: string;
  worldPoints: { x: number; y: number }[];
  realValue: number;
  classification: 'external' | 'internal';
}

async function renderPageOffscreen(
  pdfUrl: string,
  pageIndex: number,
): Promise<{ canvas: HTMLCanvasElement; pxPerPdfPoint: number }> {
  const pdf = await pdfjs.getDocument(pdfUrl).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: DETECTION_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx as any, viewport }).promise;
  return { canvas, pxPerPdfPoint: DETECTION_SCALE };
}

function toGrayscale(data: Uint8ClampedArray): Uint8Array {
  const gray = new Uint8Array(data.length / 4);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  return gray;
}

interface RawSeg { x1: number; y1: number; x2: number; y2: number }

function scanHorizontal(gray: Uint8Array, w: number, h: number, thr: number, minPx: number): RawSeg[] {
  const out: RawSeg[] = [];
  for (let y = 0; y < h; y++) {
    let s = -1;
    for (let x = 0; x <= w; x++) {
      const dark = x < w && gray[y * w + x] < thr;
      if (dark && s === -1) { s = x; }
      else if (!dark && s !== -1) {
        if (x - s >= minPx) out.push({ x1: s, y1: y, x2: x - 1, y2: y });
        s = -1;
      }
    }
  }
  return out;
}

function scanVertical(gray: Uint8Array, w: number, h: number, thr: number, minPx: number): RawSeg[] {
  const out: RawSeg[] = [];
  for (let x = 0; x < w; x++) {
    let s = -1;
    for (let y = 0; y <= h; y++) {
      const dark = y < h && gray[y * w + x] < thr;
      if (dark && s === -1) { s = y; }
      else if (!dark && s !== -1) {
        if (y - s >= minPx) out.push({ x1: x, y1: s, x2: x, y2: y - 1 });
        s = -1;
      }
    }
  }
  return out;
}

function measureThickness(gray: Uint8Array, w: number, h: number, seg: RawSeg, thr: number): number {
  const horiz = seg.y1 === seg.y2;
  const mx = Math.round((seg.x1 + seg.x2) / 2);
  const my = Math.round((seg.y1 + seg.y2) / 2);
  let t = 1;
  if (horiz) {
    let y = my - 1; while (y >= 0 && gray[y * w + mx] < thr) { t++; y--; }
    y = my + 1; while (y < h && gray[y * w + mx] < thr) { t++; y++; }
  } else {
    let x = mx - 1; while (x >= 0 && gray[my * w + x] < thr) { t++; x--; }
    x = mx + 1; while (x < w && gray[my * w + x] < thr) { t++; x++; }
  }
  return t;
}

function mergeColinear(segs: RawSeg[], horiz: boolean, gapPx: number, tolPx: number): RawSeg[] {
  if (!segs.length) return [];
  interface Group { linePos: number; segs: RawSeg[] }
  const groups: Group[] = [];
  for (const seg of segs) {
    const pos = horiz ? seg.y1 : seg.x1;
    const g = groups.find(g => Math.abs(g.linePos - pos) <= tolPx);
    if (g) g.segs.push(seg); else groups.push({ linePos: pos, segs: [seg] });
  }
  const out: RawSeg[] = [];
  for (const { segs: gs } of groups) {
    gs.sort((a, b) => horiz ? a.x1 - b.x1 : a.y1 - b.y1);
    let cur = { ...gs[0] };
    for (let i = 1; i < gs.length; i++) {
      const gap = horiz ? gs[i].x1 - cur.x2 : gs[i].y1 - cur.y2;
      if (gap <= gapPx) {
        cur = horiz ? { ...cur, x2: gs[i].x2 } : { ...cur, y2: gs[i].y2 };
      } else { out.push(cur); cur = { ...gs[i] }; }
    }
    out.push(cur);
  }
  return out;
}

function classifyByPerimeter(segs: RawSeg[]): ('external' | 'internal')[] {
  if (!segs.length) return [];
  const xs = segs.flatMap(s => [s.x1, s.x2]);
  const ys = segs.flatMap(s => [s.y1, s.y2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const tol = ((maxX - minX) + (maxY - minY)) * 0.06;
  return segs.map(s => {
    const cx = (s.x1 + s.x2) / 2, cy = (s.y1 + s.y2) / 2;
    return (cx < minX + tol || cx > maxX - tol || cy < minY + tol || cy > maxY - tol)
      ? 'external' : 'internal';
  });
}

// Return value includes a warning when too many segments found (likely a site/landscape plan)
export interface DetectionResult {
  walls: DetectedWall[];
  tooMany: boolean;   // true when raw count exceeded MAX_SEGMENTS before filtering
  rawCount: number;
}

const MAX_SEGMENTS = 25;
const MIN_WALL_METRES = 1.5;   // raised from 0.4 — eliminates text, hatching, dim lines

export async function detectWallsFromPDF(
  pdfUrl: string,
  pageIndex: number,
  unitsPerMetre: number,
): Promise<DetectionResult> {
  const { canvas, pxPerPdfPoint } = await renderPageOffscreen(pdfUrl, pageIndex);
  const ctx = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;

  // Skip outer margins (4%) and bottom title-block area (15%)
  const marginX = Math.round(w * 0.04);
  const marginYTop = Math.round(h * 0.04);
  const marginYBottom = Math.round(h * 0.15);  // title blocks live here
  const scanW = w - marginX * 2;
  const scanH = h - marginYTop - marginYBottom;

  const { data } = ctx.getImageData(marginX, marginYTop, scanW, scanH);
  const gray = toGrayscale(data);

  const THR = 80;
  const minPx = Math.max(6, Math.round(MIN_WALL_METRES * unitsPerMetre * pxPerPdfPoint));

  const rawH = scanHorizontal(gray, scanW, scanH, THR, minPx);
  const rawV = scanVertical(gray, scanW, scanH, THR, minPx);
  const mergedH = mergeColinear(rawH, true, 10, 2);
  const mergedV = mergeColinear(rawV, false, 10, 2);

  const MIN_THICK = 2;
  const filtH = mergedH.filter(s => measureThickness(gray, scanW, scanH, s, THR) >= MIN_THICK);
  const filtV = mergedV.filter(s => measureThickness(gray, scanW, scanH, s, THR) >= MIN_THICK);

  const all = [...filtH, ...filtV];
  const rawCount = all.length;
  const tooMany = rawCount > MAX_SEGMENTS;

  if (tooMany) return { walls: [], tooMany: true, rawCount };

  const classes = classifyByPerimeter(all);

  const walls = all.map((seg, i) => {
    // Re-add margins to get back to full-page coordinates before converting to world space
    const wx1 = (seg.x1 + marginX) / pxPerPdfPoint;
    const wy1 = (seg.y1 + marginYTop) / pxPerPdfPoint;
    const wx2 = (seg.x2 + marginX) / pxPerPdfPoint;
    const wy2 = (seg.y2 + marginYTop) / pxPerPdfPoint;
    const realValue = Math.hypot(wx2 - wx1, wy2 - wy1) / unitsPerMetre;
    return { id: crypto.randomUUID(), worldPoints: [{ x: wx1, y: wy1 }, { x: wx2, y: wy2 }], realValue, classification: classes[i] };
  }).filter(w => w.realValue >= MIN_WALL_METRES);

  return { walls, tooMany: false, rawCount };
}
