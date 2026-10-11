/**
 * The Estimate screen holds a copy of the lines; the takeoff (mounted in the
 * background) can add lines or update plan quantities meanwhile. Before the
 * Estimate writes, merge so nothing done elsewhere is lost:
 *  - lines saved since the screen loaded are kept,
 *  - lines this action didn't touch take their newer saved version,
 *  - lines this action changed, added or removed win.
 */
export function mergeWithSaved<T extends { id: string }>(saved: T[] | undefined, loaded: T[], updated: T[]): T[] {
  if (!Array.isArray(saved)) return updated;
  const loadedById = new Map(loaded.map(i => [i.id, i]));
  const savedById = new Map(saved.map(i => [i.id, i]));
  const updatedIds = new Set(updated.map(u => u.id));
  const merged = updated.map(u => (loadedById.get(u.id) === u && savedById.has(u.id) ? savedById.get(u.id)! : u));
  const arrived = saved.filter(i => !loadedById.has(i.id) && !updatedIds.has(i.id));
  return arrived.length ? [...merged, ...arrived] : merged;
}
