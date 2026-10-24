/**
 * Rooms from drawn walls: walls that close a space make a room. Walls are joined where
 * their ends meet (L corners), where an end stops on another wall (T junctions) and where
 * two walls cross. Each enclosed space gives:
 * - the centreline area (gross), as drawn
 * - the net floor area inside the wall faces: each side moved in by half of its own
 *   wall's thickness, corners re-joined, so mixed 90 / 110 mm walls come out right
 * - the inside perimeter (skirting, cornice)
 * A walled box standing free inside a room (a robe, a wet-area box) is taken off its area.
 * Arc walls are not used yet: a room closed by an arc wall is not found.
 */
import type { Measurement, WorldPoint } from './types';

export interface WallRoom {
  /** stable while the same walls bound the room: the sorted wall ids */
  key: string;
  wallIds: string[];
  /** inside the wall faces, in plan units, in order */
  insidePoints: WorldPoint[];
  /** where to put a label */
  centre: WorldPoint;
  grossAreaM2: number;
  netAreaM2: number;
  perimeterM: number;
  /** floor taken by free-standing walled boxes inside the room */
  islandsM2?: number;
}

interface Seg { a: WorldPoint; b: WorldPoint; half: number; wallId: string }

const area2 = (pts: WorldPoint[]) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s; // twice the signed area
};

const lineMeet = (p: WorldPoint, d: WorldPoint, q: WorldPoint, e: WorldPoint): WorldPoint | null => {
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den;
  return { x: p.x + d.x * t, y: p.y + d.y * t };
};

/** Straight walls drawn with the wall tool, for one page of one plan. */
export function wallsForRooms(measurements: Measurement[], pageIndex: number, planId?: string): Measurement[] {
  // the same walls the canvas shows for this plan; a wall re-marked as a door or window is not a wall
  return measurements.filter(m =>
    m.wallThickness !== undefined && m.type === 'line' && !m.arcControlPoint &&
    (m.measurementType as string) !== 'Door' && (m.measurementType as string) !== 'Window' &&
    m.worldPoints?.length >= 2 && m.pageIndex === pageIndex && (m.planId ?? undefined) === (planId ?? undefined));
}

export function findWallRooms(walls: Measurement[], unitsPerMetre: number, opts: { minAreaM2?: number } = {}): WallRoom[] {
  if (!(unitsPerMetre > 0)) return [];
  const upm = unitsPerMetre;
  const tol = 0.1 * upm; // ends within 100 mm count as joined
  const minArea = opts.minAreaM2 ?? 0.5;

  // 1. Segments (a wall drawn as a chain gives one segment per leg)
  const segs: Seg[] = [];
  for (const w of walls) {
    const half = ((w.wallThickness ?? 90) / 1000) * upm / 2;
    for (let i = 0; i + 1 < w.worldPoints.length; i++) {
      const a = w.worldPoints[i], b = w.worldPoints[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) > tol) segs.push({ a, b, half, wallId: w.id });
    }
  }

  // 2. Cut points along each segment: T junctions and crossings. A wall ending on the face
  //    of a thick wall (not its centreline) still joins: its end moves onto the centreline.
  const cuts: number[][] = segs.map(() => []);
  const moveEnd = new Map<string, WorldPoint>(); // "seg:a" | "seg:b" -> point on the other wall
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, len2 = dx * dx + dy * dy, len = Math.sqrt(len2);
    for (let j = 0; j < segs.length; j++) {
      if (i === j) continue;
      const o = segs[j];
      // an end of o lying on the body of s
      for (const [end, e] of [['a', o.a], ['b', o.b]] as const) {
        const t = ((e.x - s.a.x) * dx + (e.y - s.a.y) * dy) / len2;
        if (t * len <= tol || (1 - t) * len <= tol) continue;
        const dist = Math.abs((e.x - s.a.x) * dy - (e.y - s.a.y) * dx) / len;
        if (dist <= Math.max(tol, s.half + 0.05 * upm)) {
          cuts[i].push(t);
          if (dist > tol / 4) moveEnd.set(`${j}:${end}`, { x: s.a.x + dx * t, y: s.a.y + dy * t });
        }
      }
      // a proper crossing
      const ex = o.b.x - o.a.x, ey = o.b.y - o.a.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) > 1e-9) {
        const t = ((o.a.x - s.a.x) * ey - (o.a.y - s.a.y) * ex) / den;
        const u = ((o.a.x - s.a.x) * dy - (o.a.y - s.a.y) * dx) / den;
        const olen = Math.hypot(ex, ey);
        if (t * len > tol && (1 - t) * len > tol && u * olen > tol && (1 - u) * olen > tol) cuts[i].push(t);
      }
    }
  }

  // 3. Nodes: points within the tolerance are one node
  const nodes: WorldPoint[] = [];
  const nodeOf = (p: WorldPoint) => {
    for (let k = 0; k < nodes.length; k++) if (Math.hypot(nodes[k].x - p.x, nodes[k].y - p.y) <= tol) return k;
    nodes.push({ x: p.x, y: p.y });
    return nodes.length - 1;
  };

  // 4. Edges between nodes, each remembering its wall and half thickness
  const edgeMap = new Map<string, { u: number; v: number; half: number; wallId: string }>();
  segs.forEach((s, i) => {
    const ts = [0, ...cuts[i].sort((x, y) => x - y), 1];
    const ids = ts.map((t, k) => {
      const moved = k === 0 ? moveEnd.get(`${i}:a`) : k === ts.length - 1 ? moveEnd.get(`${i}:b`) : undefined;
      return nodeOf(moved ?? { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t });
    });
    for (let k = 0; k + 1 < ids.length; k++) {
      const u = ids[k], v = ids[k + 1];
      if (u === v) continue;
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (!edgeMap.has(key)) edgeMap.set(key, { u, v, half: s.half, wallId: s.wallId });
    }
  });

  // 5. Drop dead ends (a wall stub enclosing nothing), repeatedly
  let edges = [...edgeMap.values()];
  for (;;) {
    const deg = new Map<number, number>();
    for (const e of edges) { deg.set(e.u, (deg.get(e.u) ?? 0) + 1); deg.set(e.v, (deg.get(e.v) ?? 0) + 1); }
    const kept = edges.filter(e => (deg.get(e.u) ?? 0) > 1 && (deg.get(e.v) ?? 0) > 1);
    if (kept.length === edges.length) break;
    edges = kept;
  }
  if (edges.length < 3) return [];

  // 6. Faces: walk every directed edge, always taking the next edge clockwise at each node
  type Half = { from: number; to: number; e: (typeof edges)[number]; ang: number; used: boolean };
  const out = new Map<number, Half[]>();
  for (const e of edges) {
    for (const [from, to] of [[e.u, e.v], [e.v, e.u]]) {
      const h: Half = { from, to, e, used: false, ang: Math.atan2(nodes[to].y - nodes[from].y, nodes[to].x - nodes[from].x) };
      if (!out.has(from)) out.set(from, []);
      out.get(from)!.push(h);
    }
  }
  for (const list of out.values()) list.sort((p, q) => p.ang - q.ang);

  // Inside outline of a face: each side moved left of travel by its wall's half thickness.
  // For an enclosed space that is into the room; for the outside of a group, out from it.
  const outline = (face: Half[]): WorldPoint[] => {
    const n = face.length;
    const lines = face.map(f => {
      const p = nodes[f.from], q = nodes[f.to];
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const d = { x: (q.x - p.x) / len, y: (q.y - p.y) / len };
      const left = { x: -d.y, y: d.x };
      return { p: { x: p.x + left.x * f.e.half, y: p.y + left.y * f.e.half }, d, half: f.e.half, left };
    });
    const pts: WorldPoint[] = [];
    for (let k = 0; k < n; k++) {
      const prev = lines[(k - 1 + n) % n], cur = lines[k];
      const node = nodes[face[k].from];
      const straight = Math.abs(prev.d.x * cur.d.y - prev.d.y * cur.d.x) < 1e-3;
      const meet = straight ? null : lineMeet(prev.p, prev.d, cur.p, cur.d);
      // a corner further than a few wall widths out is a near-straight join: step across instead
      if (meet && Math.hypot(meet.x - node.x, meet.y - node.y) <= 4 * Math.max(prev.half, cur.half, 1e-9)) { pts.push(meet); continue; }
      pts.push({ x: node.x + prev.left.x * prev.half, y: node.y + prev.left.y * prev.half });
      if (Math.abs(prev.half - cur.half) > 1e-9 || !straight) pts.push({ x: node.x + cur.left.x * cur.half, y: node.y + cur.left.y * cur.half });
    }
    // repeated points, then points on a straight run
    const dedup = pts.filter((p, k) => { const q = pts[(k + 1) % pts.length]; return Math.hypot(p.x - q.x, p.y - q.y) > 1e-6 * upm; });
    return dedup.filter((p, k) => {
      const a = dedup[(k - 1 + dedup.length) % dedup.length], b = dedup[(k + 1) % dedup.length];
      return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) > 1e-6 * upm * upm;
    });
  };
  const perimeterOf = (pts: WorldPoint[]) => pts.reduce((sum, p, k) => { const q = pts[(k + 1) % pts.length]; return sum + Math.hypot(q.x - p.x, q.y - p.y); }, 0);
  const inside = (pt: WorldPoint, poly: WorldPoint[]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };

  const spaces: { face: Half[]; pts: WorldPoint[]; signed: number }[] = [];
  const groups: { face: Half[]; pts: WorldPoint[]; signed: number }[] = []; // outside of each group of walls
  for (const list of out.values()) {
    for (const start of list) {
      if (start.used) continue;
      const face: Half[] = [];
      let h: Half | undefined = start;
      while (h && !h.used && face.length <= edges.length * 2) {
        h.used = true;
        face.push(h);
        const at = out.get(h.to)!;
        const back = at.findIndex(x => x.to === h!.from && x.e === h!.e);
        h = at[(back - 1 + at.length) % at.length]; // next clockwise from the way back
      }
      if (face.length < 3 || h !== start) continue;
      const pts = face.map(f => nodes[f.from]);
      const signed = area2(pts);
      // with this walk, enclosed spaces come out positive; the outside of a group negative
      if (signed > 0) spaces.push({ face, pts, signed });
      else if (signed < 0) groups.push({ face, pts, signed });
    }
  }

  const rooms: WallRoom[] = [];
  for (const sp of spaces) {
    const clean = outline(sp.face);
    const netSigned = area2(clean);
    if (clean.length < 3 || netSigned <= 0) continue; // walls thicker than the space
    // free-standing wall groups inside this space (not inside another one that is)
    const islands = groups.filter(g => Math.abs(g.signed) < sp.signed && g.pts.every(p => inside(p, sp.pts)));
    const top = islands.filter(g => !islands.some(o => o !== g && Math.abs(o.signed) > Math.abs(g.signed) && g.pts.every(p => inside(p, o.pts))));
    let islandNet = 0, islandGross = 0, islandPerim = 0;
    for (const g of top) {
      // walking the outside of a group, left of travel is out from its walls: its outer faces
      const ol = outline(g.face);
      islandGross += Math.abs(g.signed) / 2;
      islandNet += Math.abs(area2(ol)) / 2;
      islandPerim += perimeterOf(ol);
    }
    const net = (netSigned / 2 - islandNet) / (upm * upm);
    if (net < minArea) continue;
    let cx = 0, cy = 0;
    for (let k = 0; k < clean.length; k++) {
      const p = clean[k], q = clean[(k + 1) % clean.length], c = p.x * q.y - q.x * p.y;
      cx += (p.x + q.x) * c; cy += (p.y + q.y) * c;
    }
    const wallIds = [...new Set(sp.face.map(f => f.e.wallId))].sort();
    const r2 = (x: number) => Math.round(x * 100) / 100;
    rooms.push({
      key: wallIds.join('|'),
      wallIds,
      insidePoints: clean,
      centre: { x: cx / (3 * netSigned), y: cy / (3 * netSigned) },
      grossAreaM2: r2((sp.signed / 2 - islandGross) / (upm * upm)),
      netAreaM2: r2(net),
      perimeterM: r2((perimeterOf(clean) + islandPerim) / upm),
      ...(top.length ? { islandsM2: r2(islandNet / (upm * upm)) } : {}),
    });
  }
  // two rooms bounded by exactly the same walls: keep keys unique
  const seen = new Map<string, number>();
  for (const r of rooms) {
    const c = seen.get(r.key) ?? 0;
    seen.set(r.key, c + 1);
    if (c) r.key = `${r.key}#${c + 1}`;
  }
  return rooms.sort((a, b) => b.netAreaM2 - a.netAreaM2);
}
