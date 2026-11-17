/**
 * Which way a door opens. A door is drawn as its opening (jamb to jamb); the hinge sits on one
 * jamb and the leaf swings to one side of the wall. The builder shows both by pointing: the
 * jamb nearest the pointer is the hinge, the side of the wall it is on is where the door opens.
 */
import type { WorldPoint } from './types';

export type DoorHinge = 'start' | 'end';
export type DoorSide = 1 | -1;
export interface DoorSwing { hinge: DoorHinge; side: DoorSide }

/** the swing the pointer shows: nearest jamb hinges, the side of the wall it is on opens */
export function pickSwing(p1: WorldPoint, p2: WorldPoint, at: WorldPoint): DoorSwing {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((at.x - p1.x) * dx + (at.y - p1.y) * dy) / len2;
  const cross = (at.x - p1.x) * -dy + (at.y - p1.y) * dx; // along the normal (-dy, dx)
  return { hinge: t <= 0.5 ? 'start' : 'end', side: cross >= 0 ? 1 : -1 };
}

/** a saved door's swing; doors from before carry only `doorFlipped` */
export function swingOf(m: { doorHinge?: DoorHinge; doorSide?: DoorSide; doorFlipped?: boolean }): DoorSwing {
  if (m.doorHinge && m.doorSide) return { hinge: m.doorHinge, side: m.doorSide };
  return m.doorFlipped ? { hinge: 'end', side: -1 } : { hinge: 'start', side: 1 };
}

/** hinge point, the other jamb, and where the open leaf ends (the leaf is as wide as the opening) */
export function doorLeaf(p1: WorldPoint, p2: WorldPoint, swing: DoorSwing): { hinge: WorldPoint; jamb: WorldPoint; leaf: WorldPoint } {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * swing.side, ny = (dx / len) * swing.side;
  const hinge = swing.hinge === 'start' ? p1 : p2;
  const jamb = swing.hinge === 'start' ? p2 : p1;
  return { hinge, jamb, leaf: { x: hinge.x + nx * len, y: hinge.y + ny * len } };
}
