import type { Assembly, AssemblyComponent, CostItemLibrary, TradeRecord } from './types';
import type { CostItem, Trade } from '@/lib/takeoff/types';

// Maps recipe trade codes → existing TRADE_OPTIONS strings in types.ts
// INSL → 'Insulation' now that 'Insulation' is in TRADE_OPTIONS
const RECIPE_TRADE_TO_APP_TRADE: Record<string, Trade> = {
  PREL: 'Preliminaries',
  CARP: 'Carpentry',
  PLST: 'Plasterboard',
  INSL: 'Insulation',
  PLMB: 'Plumbing',
  ELEC: 'Electrical',
  HVAC: 'HVAC',
  PNT:  'Painting',
};

function resolveAppTrade(tradeCode: string): Trade {
  return RECIPE_TRADE_TO_APP_TRADE[tradeCode] ?? 'General';
}

/**
 * Calculates exploded quantity for a single component.
 *
 * Formula:
 *   qty = measuredQty × qty_per_unit × (sides if side_count_applies else 1) × (1 + waste_pct/100)
 *   if rounding = up_to_pack: qty = ceil(qty / pack_size) × pack_size
 */
function calcComponentQty(
  component: AssemblyComponent,
  measuredQty: number,
  sides: number,
  packSize: number | null,
): number {
  const sideMultiplier = component.side_count_applies ? sides : 1;
  const raw = measuredQty * component.qty_per_unit * sideMultiplier * (1 + component.waste_pct / 100);

  if (component.rounding === 'up_to_pack' && packSize && packSize > 0) {
    return Math.ceil(raw / packSize) * packSize;
  }
  return raw;
}

/**
 * Explodes an assembly into CostItem[] rows ready for onAddCostItem().
 *
 * Key integration decisions:
 * - materialWastePercent = 0 and labourWastePercent = 0 on ALL output items
 *   because waste is already baked into qty by this function.
 *   EstimateTemplate must NOT apply it again.
 * - Labour components (item_type = 'labour') → labourHours = qty, unitCost = 0
 *   so they land in the Labour column of EstimateTemplate totals.
 * - Material components → unitCost = rate, labourHours = 0
 *   so they land in the Materials column.
 * - Optional components are included by default; caller may filter them out.
 */
export function explodeAssembly(
  assembly: Assembly,
  components: AssemblyComponent[],
  costItems: Record<string, CostItemLibrary>,
  trades: Record<string, TradeRecord>,
  resolvedRates: Record<string, number>,
  measuredQty: number,
  sides: number = 1,
  includeOptional: boolean = true,
): CostItem[] {
  const result: CostItem[] = [];

  const sorted = [...components].sort((a, b) => a.sort_order - b.sort_order);

  for (const comp of sorted) {
    if (comp.is_optional && !includeOptional) continue;

    const costItem = costItems[comp.cost_item_id];
    const trade    = trades[comp.trade_id];
    if (!costItem || !trade) continue;

    const rate = resolvedRates[comp.cost_item_id] ?? 0;
    const qty  = calcComponentQty(comp, measuredQty, sides, costItem.pack_size);
    const appTrade = resolveAppTrade(trade.code);
    const noteText = [
      `incl. ${comp.waste_pct}% waste`,
      `recipe: ${assembly.name}`,
      comp.notes,
    ].filter(Boolean).join(' · ');

    const isLabour = costItem.item_type === 'labour';

    const item: CostItem = {
      id:          crypto.randomUUID(),
      category:    appTrade,
      name:        costItem.name,
      description: assembly.description ?? '',
      unit:        costItem.uom,
      unitCost:    isLabour ? 0 : rate,
      quantity:    isLabour ? 1 : qty,
      linkedMeasurements: [],
      wasteFactor: 1.0,
      subtotal:    isLabour ? qty * rate : qty * rate,
      trade:       appTrade,

      // Waste already baked into qty — must be 0 to prevent double-counting in EstimateTemplate
      materialWastePercent: 0,
      labourWastePercent:   0,

      // Labour components land in the Labour column of EstimateTemplate
      labourHours:  isLabour ? qty : 0,
      hourlyRate:  isLabour ? rate : 0,

      notes: noteText,
    };

    result.push(item);
  }

  return result;
}
