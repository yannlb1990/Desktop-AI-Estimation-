import { normaliseTrade } from '@/lib/trades';
import { resolveLabourRate } from '@/lib/pricing/estimatePricing';

interface TradeLine {
  trade: string;
  labour_rate: number;
  labour_rate_override?: boolean;
  labour_hours?: number;
}

/**
 * Estimate lines saved under an older trade name ("Carpenter", "Cabinetmaker") moved to
 * the trade list's name ("Carpentry", "Joinery") without changing a cent: when the new
 * name would pick up a different hourly rate, the line keeps the rate it had as its own.
 * Returns the same array when nothing needed renaming.
 */
export function renameLineTrades<T extends TradeLine>(items: T[], labourRates: Record<string, number>, defaultLabourRate: number): T[] {
  let changed = false;
  const out = items.map(item => {
    const trade = normaliseTrade(item.trade);
    if (!trade || trade === item.trade) return item;
    changed = true;
    const before = resolveLabourRate(item, labourRates, defaultLabourRate);
    const renamed = { ...item, trade };
    const after = resolveLabourRate(renamed, labourRates, defaultLabourRate);
    return after === before || !item.labour_hours ? renamed : { ...renamed, labour_rate: before, labour_rate_override: true };
  });
  return changed ? out : items;
}
