/**
 * Plans turn in 90° steps, and pdf.js lays the turned page out in a new coordinate space.
 * Measurements are stored in that space, so when the plan turns they must turn with it,
 * or they end up beside the drawing. W and H are the page's size with no rotation.
 */
import type { Measurement, WorldPoint } from './types';

export type Rotation = 0 | 90 | 180 | 270;
const norm = (r: number) => ((((Math.round(r / 90) * 90) % 360) + 360) % 360) as Rotation;

/** a point on the page turned by `r` back to the page with no rotation */
export function toUnrotated(p: WorldPoint, r: number, W: number, H: number): WorldPoint {
  switch (norm(r)) {
    case 90: return { x: p.y, y: H - p.x };
    case 180: return { x: W - p.x, y: H - p.y };
    case 270: return { x: W - p.y, y: p.x };
    default: return { x: p.x, y: p.y };
  }
}

/** a point on the page with no rotation to the page turned by `r` (as pdf.js draws it) */
export function fromUnrotated(p: WorldPoint, r: number, W: number, H: number): WorldPoint {
  switch (norm(r)) {
    case 90: return { x: H - p.y, y: p.x };
    case 180: return { x: W - p.x, y: H - p.y };
    case 270: return { x: p.y, y: W - p.x };
    default: return { x: p.x, y: p.y };
  }
}

export function remapPoint(p: WorldPoint, from: number, to: number, W: number, H: number): WorldPoint {
  return fromUnrotated(toUnrotated(p, from, W, H), to, W, H);
}

/** The measurements on one page, moved from the plan turned `from` to the plan turned `to` */
export function remapMeasurements(ms: Measurement[], pageIndex: number, from: number, to: number, W: number, H: number, planId?: string): Measurement[] {
  if (norm(from) === norm(to) || !(W > 0) || !(H > 0)) return ms;
  const map = (p: WorldPoint) => remapPoint(p, from, to, W, H);
  return ms.map(m => {
    if (m.pageIndex !== pageIndex || (planId && m.planId && m.planId !== planId)) return m;
    const next: Measurement = { ...m, worldPoints: (m.worldPoints || []).map(map) };
    if (m.arcControlPoint) next.arcControlPoint = map(m.arcControlPoint);
    return next;
  });
}
