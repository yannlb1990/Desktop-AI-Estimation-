/**
 * A page's scale was corrected: every measurement already drawn on it changes with it.
 * Lengths follow the ratio of the old to the new scale, areas its square. Counts stay.
 */
import type { Measurement } from './types';

const LINEAR = new Set(['lm', 'm']);
const AREA = new Set(['m2', 'm²', 'sqm']);
const VOLUME = new Set(['m3', 'm³']);

export function rescaleMeasurementsForScale(
  measurements: Measurement[], pageIndex: number, oldUnitsPerMetre: number, newUnitsPerMetre: number,
): Measurement[] {
  if (!(oldUnitsPerMetre > 0) || !(newUnitsPerMetre > 0) || Math.abs(oldUnitsPerMetre - newUnitsPerMetre) < 1e-9) return measurements;
  const r = oldUnitsPerMetre / newUnitsPerMetre;
  return measurements.map(m => {
    if (m.pageIndex !== pageIndex) return m;
    const unit = String(m.unit || '').toLowerCase();
    const linear = LINEAR.has(unit), area = AREA.has(unit), volume = VOLUME.has(unit);
    if (!linear && !area && !volume) return m; // counts, items, uncalibrated pixels
    const k = linear ? r : area ? r * r : r * r * r;
    // wall area (length x height) and trench volume follow the length; slab volume the area
    const derived = linear ? r : r * r;
    const next: Measurement = { ...m, realValue: m.realValue * k };
    if (m.computedM2 != null) next.computedM2 = m.computedM2 * derived;
    if (m.computedM3 != null) next.computedM3 = m.computedM3 * derived;
    if (m.roomPerimeterM != null) next.roomPerimeterM = m.roomPerimeterM * r;
    if (m.roofRawPlanArea != null) next.roofRawPlanArea = m.roofRawPlanArea * r * r;
    if (m.dimensions) next.dimensions = { width: m.dimensions.width * r, height: m.dimensions.height * r };
    return next;
  });
}
