export interface Vec2 { x: number; y: number }
export interface BBox { minX: number; minY: number; maxX: number; maxY: number }

export const MAX_ENTITIES = 50_000;

export function arcPoints(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
  ccw: boolean, steps = 32,
): Vec2[] {
  let span = endAngle - startAngle;
  if (ccw && span < 0) span += 2 * Math.PI;
  if (!ccw && span > 0) span -= 2 * Math.PI;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = startAngle + (i / steps) * span;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

export function bulgeArc(x1: number, y1: number, x2: number, y2: number, bulge: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1e-9) return null;
  const theta = 4 * Math.atan(Math.abs(bulge));
  const r = L / (2 * Math.sin(theta / 2));
  const d = L / 2;
  const h = Math.sqrt(Math.max(0, r * r - d * d));
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const perpX = -dy / L, perpY = dx / L;
  const sign = Math.sign(bulge);
  const cx = mx + sign * h * perpX;
  const cy = my + sign * h * perpY;
  const startAngle = Math.atan2(y1 - cy, x1 - cx);
  const endAngle = Math.atan2(y2 - cy, x2 - cx);
  return { cx, cy, r, startAngle, endAngle, ccw: bulge > 0 };
}

export function expandBBox(b: BBox, x: number, y: number) {
  if (x < b.minX) b.minX = x;
  if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x;
  if (y > b.maxY) b.maxY = y;
}

export function entityBBox(e: any): BBox | null {
  const b: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const inc = (x: number, y: number) => expandBBox(b, x, y);

  switch (e.type) {
    case 'LINE':
      inc(e.start.x, e.start.y); inc(e.end.x, e.end.y); break;
    case 'LWPOLYLINE':
    case 'POLYLINE':
      for (const v of e.vertices ?? []) inc(v.x, v.y); break;
    case 'ARC':
      inc(e.center.x - e.radius, e.center.y - e.radius);
      inc(e.center.x + e.radius, e.center.y + e.radius);
      break;
    case 'CIRCLE':
      inc(e.center.x - e.radius, e.center.y - e.radius);
      inc(e.center.x + e.radius, e.center.y + e.radius);
      break;
    case 'TEXT': case 'MTEXT': {
      const p = e.position ?? e.insertionPoint;
      if (p) inc(p.x, p.y);
      break;
    }
    case 'POINT':
      if (e.position) inc(e.position.x, e.position.y); break;
    case 'SPLINE':
      for (const cp of e.controlPoints ?? e.fitPoints ?? []) inc(cp.x, cp.y); break;
    case 'ELLIPSE':
      if (e.center && e.majorAxisEndPoint) {
        const maj = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
        inc(e.center.x - maj, e.center.y - maj);
        inc(e.center.x + maj, e.center.y + maj);
      }
      break;
    default:
      return null;
  }
  if (!isFinite(b.minX)) return null;
  return b;
}

export function renderEntities(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  entities: any[],
  tx: (x: number) => number,
  ty: (y: number) => number,
  scale: number,
) {
  for (const e of entities) {
    ctx.beginPath();

    switch (e.type) {
      case 'LINE': {
        ctx.moveTo(tx(e.start.x), ty(e.start.y));
        ctx.lineTo(tx(e.end.x), ty(e.end.y));
        ctx.stroke();
        break;
      }

      case 'LWPOLYLINE': {
        const verts: Array<{ x: number; y: number; bulge?: number }> = e.vertices ?? [];
        if (verts.length < 2) break;
        ctx.moveTo(tx(verts[0].x), ty(verts[0].y));
        for (let i = 0; i < verts.length - 1; i++) {
          const v = verts[i], vn = verts[i + 1];
          const b = v.bulge ?? 0;
          if (Math.abs(b) > 1e-6) {
            const arc = bulgeArc(v.x, v.y, vn.x, vn.y, b);
            if (arc) {
              for (const pt of arcPoints(arc.cx, arc.cy, arc.r, arc.startAngle, arc.endAngle, arc.ccw)) {
                ctx.lineTo(tx(pt.x), ty(pt.y));
              }
            } else {
              ctx.lineTo(tx(vn.x), ty(vn.y));
            }
          } else {
            ctx.lineTo(tx(vn.x), ty(vn.y));
          }
        }
        if (e.shape) {
          const last = verts[verts.length - 1];
          const first = verts[0];
          const b = last.bulge ?? 0;
          if (Math.abs(b) > 1e-6) {
            const arc = bulgeArc(last.x, last.y, first.x, first.y, b);
            if (arc) {
              for (const pt of arcPoints(arc.cx, arc.cy, arc.r, arc.startAngle, arc.endAngle, arc.ccw)) {
                ctx.lineTo(tx(pt.x), ty(pt.y));
              }
            }
          }
          ctx.closePath();
        }
        ctx.stroke();
        break;
      }

      case 'POLYLINE': {
        const verts: Array<{ x: number; y: number }> = e.vertices ?? [];
        if (verts.length < 2) break;
        ctx.moveTo(tx(verts[0].x), ty(verts[0].y));
        for (let i = 1; i < verts.length; i++) ctx.lineTo(tx(verts[i].x), ty(verts[i].y));
        if (e.shape) ctx.closePath();
        ctx.stroke();
        break;
      }

      case 'ARC': {
        const { center, radius, startAngle, endAngle } = e;
        const sa = startAngle * Math.PI / 180;
        const ea = endAngle * Math.PI / 180;
        const pts = arcPoints(center.x, center.y, radius, sa, ea, true);
        if (pts.length === 0) break;
        ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
        ctx.stroke();
        break;
      }

      case 'CIRCLE': {
        const { center, radius } = e;
        const pts = arcPoints(center.x, center.y, radius, 0, 2 * Math.PI, true, 64);
        ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
        ctx.closePath();
        ctx.stroke();
        break;
      }

      case 'SPLINE': {
        const pts: Vec2[] = e.controlPoints ?? e.fitPoints ?? [];
        if (pts.length < 2) break;
        ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
        ctx.stroke();
        break;
      }

      case 'ELLIPSE': {
        if (!e.center || !e.majorAxisEndPoint) break;
        const cx = e.center.x, cy = e.center.y;
        const maj = Math.sqrt(e.majorAxisEndPoint.x ** 2 + e.majorAxisEndPoint.y ** 2);
        const min = maj * (e.axisRatio ?? 0.5);
        const rot = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x);
        const sa = e.startAngle ?? 0, ea = e.endAngle ?? 2 * Math.PI;
        const steps = 64;
        let span = ea - sa;
        if (span <= 0) span += 2 * Math.PI;
        let first = true;
        for (let i = 0; i <= steps; i++) {
          const a = sa + (i / steps) * span;
          const lx = maj * Math.cos(a), ly = min * Math.sin(a);
          const wx = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
          const wy = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
          if (first) { ctx.moveTo(tx(wx), ty(wy)); first = false; }
          else ctx.lineTo(tx(wx), ty(wy));
        }
        ctx.stroke();
        break;
      }

      case 'TEXT': case 'MTEXT': {
        const pos = e.position ?? e.insertionPoint;
        if (!pos || !e.text) break;
        const fh = Math.max(8, (e.textHeight ?? 2.5) * scale);
        (ctx as any).font = `${fh}px sans-serif`;
        (ctx as any).fillStyle = '#1a1a2e';
        const clean = (e.text as string).replace(/\{[^}]*\}/g, '').replace(/\\P/gi, ' ');
        (ctx as any).fillText(clean, tx(pos.x), ty(pos.y));
        break;
      }

      case 'POINT': {
        if (!e.position) break;
        ctx.arc(tx(e.position.x), ty(e.position.y), Math.max(1.5, scale * 0.4), 0, 2 * Math.PI);
        (ctx as any).fill();
        break;
      }
    }
  }
}

export function computeLayout(
  entities: any[],
  targetMaxDim: number,
  PADDING = 40,
) {
  const bbox: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const e of entities) {
    const b = entityBBox(e);
    if (b) {
      expandBBox(bbox, b.minX, b.minY);
      expandBBox(bbox, b.maxX, b.maxY);
    }
  }
  if (!isFinite(bbox.minX)) return null;

  const dxfW = bbox.maxX - bbox.minX;
  const dxfH = bbox.maxY - bbox.minY;
  if (dxfW < 1e-6 || dxfH < 1e-6) return null;

  const scale = Math.min(targetMaxDim / dxfW, targetMaxDim / dxfH);
  const canvasW = Math.round(dxfW * scale) + PADDING * 2;
  const canvasH = Math.round(dxfH * scale) + PADDING * 2;

  const tx = (x: number) => PADDING + (x - bbox.minX) * scale;
  const ty = (y: number) => PADDING + (bbox.maxY - y) * scale;

  return { scale, canvasW, canvasH, tx, ty };
}
