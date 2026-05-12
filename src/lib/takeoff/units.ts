/** Curated construction unit list — 25 practical units across 6 categories. */

export interface UnitOption {
  value: string;
  label: string;
  group: string;
}

export const TAKEOFF_UNITS: UnitOption[] = [
  // ── Length ──
  { value: 'LM',   label: 'LM — linear metre',  group: 'Length' },
  { value: 'm',    label: 'm — metre',           group: 'Length' },
  { value: 'mm',   label: 'mm — millimetre',     group: 'Length' },
  { value: 'cm',   label: 'cm — centimetre',     group: 'Length' },
  // ── Area ──
  { value: 'M2',   label: 'M² — square metre',   group: 'Area' },
  { value: 'm2',   label: 'm² (alt)',             group: 'Area' },
  // ── Volume ──
  { value: 'M3',   label: 'M³ — cubic metre',    group: 'Volume' },
  { value: 'm3',   label: 'm³ (alt)',             group: 'Volume' },
  { value: 'l',    label: 'L — litre',           group: 'Volume' },
  // ── Count ──
  { value: 'count', label: 'count / qty',        group: 'Count' },
  { value: 'ea',   label: 'ea — each',           group: 'Count' },
  { value: 'pcs',  label: 'pcs — pieces',        group: 'Count' },
  { value: 'set',  label: 'set',                 group: 'Count' },
  { value: 'item', label: 'item',                group: 'Count' },
  { value: 'door', label: 'door',                group: 'Count' },
  { value: 'win',  label: 'window',              group: 'Count' },
  { value: 'fixture', label: 'fixture',          group: 'Count' },
  { value: 'point',   label: 'point',            group: 'Count' },
  // ── Mass ──
  { value: 'kg',   label: 'kg — kilogram',       group: 'Mass' },
  { value: 't',    label: 't — tonne',           group: 'Mass' },
  // ── Labour / Time ──
  { value: 'hr',   label: 'hr — hour',           group: 'Labour' },
  { value: 'day',  label: 'day',                 group: 'Labour' },
  { value: 'wk',   label: 'wk — week',           group: 'Labour' },
  // ── Lump Sum ──
  { value: 'lsum', label: 'lsum — lump sum',     group: 'Lump Sum' },
  { value: 'job',  label: 'job',                 group: 'Lump Sum' },
];

/** Unique group names in display order. */
export const UNIT_GROUPS = Array.from(new Set(TAKEOFF_UNITS.map((u) => u.group)));
