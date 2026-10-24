import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Measurement, MeasurementArea } from '@/lib/takeoff/types';
import { findWallRooms, wallsForRooms, type WallRoom } from '@/lib/takeoff/wallRooms';
import { calculatePolygonAreaWorld } from '@/lib/takeoff/calculations';

const ROOM_TYPES: MeasurementArea[] = ['Kitchen', 'Bathroom', 'Bedroom', 'Living Room', 'Dining Room', 'Laundry', 'Garage', 'Patio', 'Balcony', 'Hallway', 'Entry', 'Office', 'Storage', 'Utility', 'Ensuite', 'WC'];

/** The room type a name points to: "Bed 2" is a Bedroom, "Ens" an Ensuite. */
function roomTypeOf(name: string): MeasurementArea | undefined {
  const n = name.toLowerCase();
  if (/\bens(uite)?\b/.test(n)) return 'Ensuite';
  if (/bath/.test(n)) return 'Bathroom';
  if (/bed/.test(n)) return 'Bedroom';
  if (/\bwc\b|toilet/.test(n)) return 'WC';
  if (/laundry|ldry/.test(n)) return 'Laundry';
  if (/kitchen|kit\b/.test(n)) return 'Kitchen';
  if (/living|lounge|family|rumpus/.test(n)) return 'Living Room';
  if (/dining|meals/.test(n)) return 'Dining Room';
  if (/hall|corridor/.test(n)) return 'Hallway';
  if (/entry|foyer/.test(n)) return 'Entry';
  if (/garage/.test(n)) return 'Garage';
  if (/study|office/.test(n)) return 'Office';
  if (/robe|store|storage|pantry|linen/.test(n)) return 'Storage';
  return ROOM_TYPES.find(t => n.includes(t.toLowerCase()));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurements: Measurement[];
  pageIndex: number;
  planId?: string;
  unitsPerMetre: number | null;
  onAdd: (rooms: Measurement[]) => void;
  onUpdate: (id: string, updates: Partial<Measurement>) => void;
  onRemove: (id: string) => void;
}

const insidePoly = (pt: { x: number; y: number }, poly: { x: number; y: number }[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

/**
 * Rooms closed by walls drawn with the wall tool, ready to add as floor areas. A room added
 * here stays tied to its walls (roomKey): if a wall moves, the room offers "Update area",
 * and estimate lines linked to that floor area follow.
 */
export function RoomsFromWallsDialog({ open, onOpenChange, measurements, pageIndex, planId, unitsPerMetre, onAdd, onUpdate, onRemove }: Props) {
  const rooms = useMemo<WallRoom[]>(() => {
    if (!open || !unitsPerMetre) return [];
    return findWallRooms(wallsForRooms(measurements, pageIndex, planId), unitsPerMetre);
  }, [open, measurements, pageIndex, planId, unitsPerMetre]);

  // Rooms already added, matched to what the walls show now: by the same walls, or, when
  // walls were redrawn or moved, by being the only room found inside the old outline.
  // An added room with no match (split in two, or no longer closed) is listed on its own.
  const { existing, orphans, insideOrphan } = useMemo(() => {
    const added = measurements.filter(m => m.roomKey && m.pageIndex === pageIndex && (m.planId ?? undefined) === (planId ?? undefined));
    const byKey = new Map<string, Measurement>();
    const left = added.filter(m => {
      const r = rooms.find(x => x.key === m.roomKey);
      if (r) { byKey.set(r.key, m); return false; }
      return true;
    });
    const orphans: Measurement[] = [];
    const insideOrphan = new Set<string>();
    for (const m of left) {
      const within = rooms.filter(r => !byKey.has(r.key) && insidePoly(r.centre, m.worldPoints));
      if (within.length === 1) byKey.set(within[0].key, m);
      else { orphans.push(m); within.forEach(r => insideOrphan.add(r.key)); }
    }
    return { existing: byKey, orphans, insideOrphan };
  }, [measurements, pageIndex, planId, rooms]);

  const [names, setNames] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    setNames({});
    // rooms where an added room used to be are not ticked: that floor area is counted already
    setPicked(new Set(rooms.filter(r => !existing.has(r.key) && !insideOrphan.has(r.key)).map(r => r.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const nameFor = (r: WallRoom, i: number) => names[r.key] ?? existing.get(r.key)?.label ?? `Room ${i + 1}`;
  const toAdd = rooms.filter(r => picked.has(r.key) && !existing.has(r.key));
  const changed = rooms.filter(r => {
    const m = existing.get(r.key);
    return m && (m.roomKey !== r.key || Math.abs((m.realValue || 0) - r.netAreaM2) >= 0.01);
  });
  const fromWallsNote = (r: WallRoom) =>
    `From walls: ${r.netAreaM2} m² inside the wall faces${r.islandsM2 ? ` (less ${r.islandsM2} m² of walled boxes inside)` : ''}, perimeter ${r.perimeterM} m`;

  const asMeasurement = (r: WallRoom, name: string): Measurement => {
    const world = calculatePolygonAreaWorld(r.insidePoints, unitsPerMetre || 1);
    return {
      id: crypto.randomUUID(),
      type: 'polygon',
      worldPoints: r.insidePoints,
      worldValue: world.worldValue,
      realValue: r.netAreaM2,
      unit: 'M2',
      color: '#D4A045',
      label: name.trim() || 'Room',
      area: roomTypeOf(name),
      measurementType: 'Floor',
      pageIndex,
      planId,
      roomKey: r.key,
      roomPerimeterM: r.perimeterM,
      comments: fromWallsNote(r),
      timestamp: new Date().toISOString(),
    };
  };

  const add = () => {
    onAdd(toAdd.map(r => asMeasurement(r, nameFor(r, rooms.indexOf(r)))));
    onOpenChange(false);
  };
  const update = (r: WallRoom) => {
    const m = existing.get(r.key);
    if (!m) return;
    const world = calculatePolygonAreaWorld(r.insidePoints, unitsPerMetre || 1);
    onUpdate(m.id, { worldPoints: r.insidePoints, worldValue: world.worldValue, realValue: r.netAreaM2, roomPerimeterM: r.perimeterM, roomKey: r.key, comments: fromWallsNote(r) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto z-[10002]">
        <DialogHeader>
          <DialogTitle>Rooms from walls</DialogTitle>
        </DialogHeader>

        {!unitsPerMetre ? (
          <p className="text-sm text-muted-foreground">Set the scale first: room areas need it.</p>
        ) : rooms.length === 0 ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>No closed rooms on this page yet.</p>
            <p>A room is found when walls drawn with the wall tool close all the way round it: ends meet (snap to the end of the last wall) or stop on another wall. Draw walls straight through door and window openings. Curved walls are not used yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Areas are inside the wall faces, using each wall's own thickness. Added rooms go in as floor areas you can price like any other.
            </p>
            {rooms.map((r, i) => {
              const m = existing.get(r.key);
              const moved = changed.includes(r);
              return (
                <div key={r.key} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                  <input
                    type="checkbox"
                    disabled={!!m}
                    checked={!!m || picked.has(r.key)}
                    onChange={e => setPicked(s => { const n = new Set(s); e.target.checked ? n.add(r.key) : n.delete(r.key); return n; })}
                  />
                  {m ? (
                    <span className="flex-1 truncate text-sm">{m.label}</span>
                  ) : (
                    <Input
                      className="h-8 flex-1"
                      value={nameFor(r, i)}
                      onChange={e => setNames(s => ({ ...s, [r.key]: e.target.value }))}
                    />
                  )}
                  <span className="w-36 shrink-0 text-right font-mono text-xs">
                    {r.netAreaM2} m²
                    <span className="block text-muted-foreground">perimeter {r.perimeterM} m</span>
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs">
                    {moved ? (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => update(r)}>Update area</Button>
                    ) : m ? <span className="text-[#D4A045]">Added</span> : null}
                  </span>
                </div>
              );
            })}
            {orphans.map(m => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-amber-400/50 bg-amber-400/5 px-3 py-2 text-sm">
                <span className="flex-1">
                  {m.label} <span className="font-mono text-xs">{m.realValue} m²</span>
                  <span className="block text-xs text-muted-foreground">Its walls changed: the room is split or no longer closed. Remove it and add the rooms there now, or keep it as it is.</span>
                </span>
                <Button size="sm" variant="outline" className="h-7" onClick={() => onRemove(m.id)}>Remove</Button>
              </div>
            ))}
            {changed.length > 0 && (
              <p className="text-xs text-amber-400">
                Walls moved since {changed.length === 1 ? 'a room was' : 'some rooms were'} added: Update area brings the floor area, and estimate lines linked to it, up to date.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={toAdd.length === 0} onClick={add}>
            {toAdd.length ? `Add ${toAdd.length} room${toAdd.length !== 1 ? 's' : ''} as floor areas` : 'Add rooms'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
