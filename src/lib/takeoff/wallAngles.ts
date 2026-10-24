/**
 * Corner angles between walls, for the squareness checks on the plan: the angle readout
 * while drawing a wall, and the marks on corners at rest.
 */
import type { Measurement, WorldPoint } from './types';

/** Angle at corner `at` between the directions to `a` and to `b`, 0 to 180 degrees. */
export function cornerAngle(at: WorldPoint, a: WorldPoint, b: WorldPoint): number {
  const ux = a.x - at.x, uy = a.y - at.y, vx = b.x - at.x, vy = b.y - at.y;
  const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  if (lu === 0 || lv === 0) return 180;
  const c = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)));
  return (Math.acos(c) * 180) / Math.PI;
}

const isWall = (m: Measurement) => m.wallThickness !== undefined && m.type === 'line' && !m.arcControlPoint && (m.worldPoints?.length ?? 0) >= 2;

/**
 * While drawing from `start` to `end`: the corner made with the wall it starts from, or the
 * wall whose end it is about to meet. null when it touches no wall end.
 */
export function drawingCornerAngle(start: WorldPoint, end: WorldPoint, walls: Iterable<Measurement>, tol: number): number | null {
  let best: { deg: number; d: number } | null = null;
  for (const m of walls) {
    if (!isWall(m)) continue;
    const p = m.worldPoints[0], q = m.worldPoints[m.worldPoints.length - 1];
    for (const [corner, far] of [[start, end], [end, start]] as const) {
      for (const [e, o] of [[p, m.worldPoints[1]], [q, m.worldPoints[m.worldPoints.length - 2]]]) {
        const d = Math.hypot(e.x - corner.x, e.y - corner.y);
        if (d > tol || (best && best.d <= d)) continue;
        best = { deg: cornerAngle(corner, far, o), d };
      }
    }
  }
  return best ? best.deg : null;
}

export interface WallCorner { at: WorldPoint; deg: number; dirA: WorldPoint; dirB: WorldPoint; halfA: number; halfB: number }

/** Corners where two straight walls meet end to end (not straight runs). */
export function wallCorners(walls: Measurement[], tol: number, unitsPerMetre: number): WallCorner[] {
  const ends: { p: WorldPoint; o: WorldPoint; half: number; id: string }[] = [];
  for (const m of walls) {
    if (!isWall(m)) continue;
    const pts = m.worldPoints, half = ((m.wallThickness ?? 90) / 1000) * unitsPerMetre / 2;
    ends.push({ p: pts[0], o: pts[1], half, id: m.id });
    ends.push({ p: pts[pts.length - 1], o: pts[pts.length - 2], half, id: m.id });
  }
  const out: WallCorner[] = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const A = ends[i], B = ends[j];
      if (A.id === B.id) continue;
      if (Math.hypot(A.p.x - B.p.x, A.p.y - B.p.y) > tol) continue;
      const at = { x: (A.p.x + B.p.x) / 2, y: (A.p.y + B.p.y) / 2 };
      const deg = cornerAngle(at, A.o, B.o);
      if (deg > 175) continue; // straight on
      const unit = (v: WorldPoint) => { const l = Math.hypot(v.x - at.x, v.y - at.y) || 1; return { x: (v.x - at.x) / l, y: (v.y - at.y) / l }; };
      out.push({ at, deg, dirA: unit(A.o), dirB: unit(B.o), halfA: A.half, halfB: B.half });
    }
  }
  return out;
}

/** How to show a corner: square, nearly square (worth a look), or neither. */
export function squareness(deg: number): 'square' | 'off' | null {
  const off = Math.abs(deg - 90);
  if (off <= 0.5) return 'square';
  if (off <= 10) return 'off';
  return null;
}
