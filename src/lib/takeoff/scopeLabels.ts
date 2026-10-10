/**
 * A measurement's label is its size ("19.98 m²", "16.24 m² + 19.51 m²", "4 × Door").
 * That must never become an item name or scope of work, which should say what the
 * work is.
 */
const UNIT = '(m²|m2|m³|m3|m|lm|mm|px²|px|ea)';
const VALUE_ONLY = new RegExp(`^\\s*[\\d.,]+\\s*${UNIT}?(\\s*\\+\\s*[\\d.,]+\\s*${UNIT}?)*\\s*$`, 'i');

export function isMeasurementValueLabel(text?: string | null): boolean {
  return !!text && VALUE_ONLY.test(text);
}

/** "Tiling - Bathroom", or "Measured area - External" when no type of work was picked. */
export function workLabelForMeasurement(m: {
  label?: string | null;
  measurementType?: string | null;
  area?: string | null;
  unit?: string | null;
}): string {
  if (m.label && !isMeasurementValueLabel(m.label)) return m.label;
  const type = m.measurementType && m.measurementType !== 'Other' && m.measurementType !== 'General'
    ? m.measurementType
    : null;
  const unit = (m.unit || '').toUpperCase();
  const base = type ?? (unit === 'LM' || unit === 'M' ? 'Measured length' : unit === 'COUNT' || unit === 'EA' ? 'Counted items' : 'Measured area');
  return m.area && m.area !== 'General' ? `${base} - ${m.area}` : base;
}

/** What a client sees for a line: the scope, unless it's only a size. */
export function scopeForDisplay(item: { scope_of_work?: string | null; material_type?: string | null; trade?: string | null }): string {
  if (item.scope_of_work && !isMeasurementValueLabel(item.scope_of_work)) return item.scope_of_work;
  return item.material_type || item.trade || 'Item';
}
