import type { Measurement, MeasurementUnit } from './types';

export interface GroupSummary {
  /** Area name (e.g. "Kitchen") or "General" when unset. */
  name: string;
  /** Dominant hex color used by measurements in this group — drives the legend chip. */
  color: string;
  /** Number of measurements. */
  count: number;
  /** Sum of realValue across all measurements in the group. */
  total: number;
  /** Most common unit — used as the summary label. */
  unit: MeasurementUnit;
}

/**
 * Compute one GroupSummary row per distinct area (or "General" when area is
 * unset).  The legend chip color is the most-used color within the group.
 */
export function computeGroupSummaries(measurements: Measurement[]): GroupSummary[] {
  const byArea = new Map<
    string,
    { colorCounts: Record<string, number>; unitCounts: Record<string, number>; total: number; count: number }
  >();

  for (const m of measurements) {
    const name = m.area || 'General';
    let entry = byArea.get(name);
    if (!entry) {
      entry = { colorCounts: {}, unitCounts: {}, total: 0, count: 0 };
      byArea.set(name, entry);
    }
    entry.count += 1;
    entry.total += m.realValue;
    entry.colorCounts[m.color] = (entry.colorCounts[m.color] ?? 0) + 1;
    entry.unitCounts[m.unit] = (entry.unitCounts[m.unit] ?? 0) + 1;
  }

  const summaries: GroupSummary[] = [];
  for (const [name, { colorCounts, unitCounts, total, count }] of byArea.entries()) {
    const colorEntries = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
    const color = colorEntries[0]?.[0] ?? '#3B82F6';

    const unitEntries = Object.entries(unitCounts).sort((a, b) => b[1] - a[1]);
    const unit = (unitEntries[0]?.[0] ?? 'LM') as MeasurementUnit;

    summaries.push({ name, color, count, total, unit });
  }

  summaries.sort((a, b) => a.name.localeCompare(b.name));
  return summaries;
}

/** Format a group total for the legend row. */
export function formatGroupTotal(total: number, unit: MeasurementUnit): string {
  if (unit === 'count') return `${Math.round(total)}`;
  const precision = total >= 100 ? 1 : total >= 1 ? 2 : 3;
  const rounded = Number(total.toFixed(precision));
  const label = unit === 'LM' ? 'm' : unit === 'M2' ? 'm²' : 'm³';
  return `${rounded} ${label}`;
}
