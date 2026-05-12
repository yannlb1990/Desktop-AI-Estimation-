/**
 * Pure ledger helpers: sort, filter, per-group subtotals, per-unit grand
 * totals, and improved CSV export for the measurement ledger.
 *
 * Adapted from OpenConstructionERP takeoff-ledger.ts to match this project's
 * Measurement shape (realValue / pageIndex / area / label / unit).
 */

import type { Measurement, MeasurementUnit } from './types';

export type LedgerSortColumn = 'ordinal' | 'type' | 'label' | 'area' | 'value' | 'unit' | 'page';
export type SortDirection = 'asc' | 'desc';

export interface LedgerFilter {
  /** Allowed area names — empty set means "allow all". */
  areas: Set<string>;
  /** Allowed measurement types — empty set means "allow all". */
  types: Set<string>;
  /** Allowed page indices (0-based) — empty set means "allow all". */
  pages: Set<number>;
}

export interface LedgerRow {
  ordinal: number;
  measurement: Measurement;
}

export interface GroupSubtotal {
  group: string;
  totals: Record<string, number>;
  count: number;
}

export interface UnitGrandTotal {
  unit: string;
  total: number;
  count: number;
}

/** Apply the current filter.  Empty sets are treated as "no restriction". */
export function filterMeasurements(
  measurements: Measurement[],
  filter: LedgerFilter,
): Measurement[] {
  return measurements.filter((m) => {
    if (filter.areas.size > 0 && !filter.areas.has(m.area || 'General')) return false;
    if (filter.types.size > 0 && !filter.types.has(m.type)) return false;
    if (filter.pages.size > 0 && !filter.pages.has(m.pageIndex)) return false;
    return true;
  });
}

/** Sort measurements by the requested column + direction.  Returns a new array. */
export function sortMeasurements(
  measurements: Measurement[],
  column: LedgerSortColumn,
  direction: SortDirection,
): Measurement[] {
  const mult = direction === 'asc' ? 1 : -1;
  const out = [...measurements];
  out.sort((a, b) => {
    const primary = compareByColumn(a, b, column);
    if (primary !== 0) return primary * mult;
    if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
    return a.id.localeCompare(b.id);
  });
  return out;
}

function compareByColumn(a: Measurement, b: Measurement, col: LedgerSortColumn): number {
  switch (col) {
    case 'ordinal':  return a.id.localeCompare(b.id);
    case 'type':     return a.type.localeCompare(b.type);
    case 'label':    return (a.label || '').localeCompare(b.label || '');
    case 'area':     return (a.area || 'General').localeCompare(b.area || 'General');
    case 'value':    return a.realValue - b.realValue;
    case 'unit':     return a.unit.localeCompare(b.unit);
    case 'page':     return a.pageIndex - b.pageIndex;
  }
}

/** Assign 1-based display ordinals in current sort order. */
export function withOrdinals(measurements: Measurement[]): LedgerRow[] {
  return measurements.map((measurement, index) => ({ ordinal: index + 1, measurement }));
}

/** Per-group subtotals keyed by unit so LM / M2 / M3 totals stay distinct. */
export function groupSubtotals(measurements: Measurement[]): GroupSubtotal[] {
  const byGroup = new Map<string, GroupSubtotal>();
  for (const m of measurements) {
    const group = m.area || 'General';
    let entry = byGroup.get(group);
    if (!entry) {
      entry = { group, totals: {}, count: 0 };
      byGroup.set(group, entry);
    }
    entry.count += 1;
    entry.totals[m.unit] = (entry.totals[m.unit] ?? 0) + m.realValue;
  }
  return Array.from(byGroup.values()).sort((a, b) => a.group.localeCompare(b.group));
}

/** Grand totals per unit — for the CSV footer. */
export function unitGrandTotals(measurements: Measurement[]): UnitGrandTotal[] {
  const byUnit = new Map<MeasurementUnit, UnitGrandTotal>();
  for (const m of measurements) {
    let entry = byUnit.get(m.unit);
    if (!entry) {
      entry = { unit: m.unit, total: 0, count: 0 };
      byUnit.set(m.unit, entry);
    }
    entry.total += m.realValue;
    entry.count += 1;
  }
  return Array.from(byUnit.values()).sort((a, b) => a.unit.localeCompare(b.unit));
}

/**
 * Build a CSV string with group subtotal rows and unit grand-total rows.
 * Replaces the flat exportMeasurementsToCSV for download.
 */
export function ledgerToCsv(measurements: Measurement[]): string {
  const header = '#,Type,Label,Area,Value,Unit,Page';
  const rows: string[] = [header];

  const ordered = withOrdinals(measurements);
  const byGroup = new Map<string, LedgerRow[]>();
  for (const row of ordered) {
    const g = row.measurement.area || 'General';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(row);
  }

  for (const [group, groupRows] of byGroup.entries()) {
    for (const { ordinal, measurement: m } of groupRows) {
      rows.push([
        String(ordinal),
        q(m.type),
        q(m.label || ''),
        q(group),
        fmtNum(m.realValue),
        q(m.unit),
        String(m.pageIndex + 1),
      ].join(','));
    }

    // Subtotal row(s) — one per non-zero unit in this group.
    const subs = groupSubtotals(groupRows.map((r) => r.measurement))[0];
    if (subs) {
      for (const [unit, total] of Object.entries(subs.totals) as [MeasurementUnit, number][]) {
        if (total === 0) continue;
        rows.push([
          '',
          'subtotal',
          q(`${group} subtotal`),
          q(group),
          fmtNum(total),
          q(unit),
          '',
        ].join(','));
      }
    }
  }

  for (const gt of unitGrandTotals(measurements)) {
    rows.push([
      '',
      'grand_total',
      q(`Total ${gt.unit}`),
      '',
      fmtNum(gt.total),
      q(gt.unit),
      '',
    ].join(','));
  }

  return rows.join('\n');
}

function q(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function fmtNum(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs < 1) return value.toFixed(3);
  if (abs < 100) return value.toFixed(2);
  return value.toFixed(1);
}

/** Unique options for filter dropdowns, derived from the measurement list. */
export function uniqueFilterOptions(measurements: Measurement[]): {
  areas: string[];
  types: string[];
  pages: number[];
} {
  const areas = new Set<string>();
  const types = new Set<string>();
  const pages = new Set<number>();
  for (const m of measurements) {
    areas.add(m.area || 'General');
    types.add(m.type);
    pages.add(m.pageIndex);
  }
  return {
    areas: Array.from(areas).sort(),
    types: Array.from(types).sort(),
    pages: Array.from(pages).sort((a, b) => a - b),
  };
}

/** Create an empty (no-restriction) filter. */
export function emptyFilter(): LedgerFilter {
  return { areas: new Set(), types: new Set(), pages: new Set() };
}
