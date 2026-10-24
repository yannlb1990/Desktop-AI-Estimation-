/**
 * A site visit as draft estimate lines: one line per ticked item per room, quantity from
 * the room's sizes (tiles from wall area, waterproofing from floor area...). Each draft has
 * a stable key, so a visit sent again with changes never adds the same line twice.
 */
import { SCOPE_BY_ROOM, roomQuantities, scopeQuantity, type SiteVisit } from './visit';

export interface SiteDraftLine {
  /** visit id + room id + scope key */
  key: string;
  roomId: string;
  roomName: string;
  scope: string;
  trade: string;
  unit: string;
  quantity: number;
  /** how the quantity was worked out, shown next to the line */
  basis: string;
  /** the room has no sizes yet, so the quantity needs entering */
  needsQuantity: boolean;
  /** what the site said, when the estimator typed a different quantity before adding */
  siteQuantity?: number;
}

const BASIS_TEXT: Record<string, string> = { floor: 'floor area', ceiling: 'ceiling area', walls: 'wall area', perimeter: 'perimeter', each: 'count' };

export function draftLinesFromVisit(v: SiteVisit): SiteDraftLine[] {
  const out: SiteDraftLine[] = [];
  for (const room of v.rooms) {
    const q = roomQuantities(room);
    for (const m of room.measures ?? []) {
      if (!m.label.trim() && !(Number(m.value) > 0)) continue;
      out.push({
        key: `${v.id}:${room.id}:m:${m.id}`,
        roomId: room.id, roomName: room.name,
        scope: m.label.trim() || 'Site measurement',
        trade: m.trade || 'General', unit: m.unit,
        quantity: Number(m.value) || 0,
        basis: `measured on site in ${room.name}`,
        needsQuantity: !(Number(m.value) > 0),
      });
    }
    for (const key of room.scope) {
      const opt = SCOPE_BY_ROOM[room.type]?.find(o => o.key === key);
      if (!opt) continue;
      const quantity = scopeQuantity(opt, q);
      out.push({
        key: `${v.id}:${room.id}:${key}`,
        roomId: room.id,
        roomName: room.name,
        scope: opt.label,
        trade: opt.trade,
        unit: opt.unit,
        quantity,
        basis: opt.qtyFrom === 'each' ? 'count from site, check' : `${BASIS_TEXT[opt.qtyFrom]} of ${room.name}`,
        needsQuantity: opt.qtyFrom !== 'each' && quantity <= 0,
      });
    }
  }
  return out;
}

/** The scope-of-work text for a visit: whole-job notes, then each room's notes and ticks. */
export function siteScopeText(v: SiteVisit): string {
  const parts: string[] = [];
  if (v.notes.trim()) parts.push(`Site notes: ${v.notes.trim()}`);
  for (const room of v.rooms) {
    const ticks = room.scope.map(k => SCOPE_BY_ROOM[room.type]?.find(o => o.key === k)?.label).filter(Boolean);
    if (!ticks.length && !room.notes.trim() && !(room.measures ?? []).length) continue;
    const q = roomQuantities(room);
    const size = Number(room.areaM2) > 0 ? ` (${q.floor} m²${room.heightM ? `, ${room.heightM} m high` : ''})`
      : room.lengthM && room.widthM ? ` (${room.lengthM} x ${room.widthM} m${room.heightM ? `, ${room.heightM} m high` : ''})`
      : '';
    const measures = (room.measures ?? []).filter(m => m.label.trim() && Number(m.value) > 0).map(m => `${m.label.trim()} ${m.value} ${m.unit}`);
    parts.push(`${room.name}${size}: ${[ticks.join(', '), measures.join(', '), room.notes.trim()].filter(Boolean).join('. ')}`);
  }
  return parts.join('\n');
}
