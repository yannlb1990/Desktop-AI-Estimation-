import { getUserStorageKey } from '@/lib/localAuth';
import type { UserPricingDefaults } from './estimatePricing';
import { marketLabourRatesForState, getCustomRates } from '@/data/labourRates';
import { stateFromAddress, profileState } from '@/lib/defaultState';

/**
 * Defaults for a project that hasn't saved its own pricing yet.
 *
 * Labour rate rule (most specific wins; the line's own rate is applied later):
 *   1. your rate for the trade: Settings → Rates presets, else the rate saved with
 *      "Save as profile default" on the Costs tab
 *   2. market typical for the project's state (national typical × state factor)
 *   3. built-in fallback in estimatePricing.ts
 */
export function readUserPricingDefaults(project?: any): UserPricingDefaults {
  const state = stateFromAddress(project?.site_address || project?.address)
    ?? stateFromAddress(project?.state)
    ?? profileState()
    ?? 'NSW';
  const defaults: UserPricingDefaults = { config: {}, labourRates: { ...marketLabourRatesForState(state), ...getCustomRates() } };
  try {
    const savedRates = localStorage.getItem(getUserStorageKey('default_rates'));
    if (savedRates) {
      const r = JSON.parse(savedRates);
      const labourRate = parseFloat(r.labourRate);
      if (!isNaN(labourRate) && labourRate > 0) defaults.config.defaultLabourRate = labourRate;
      if (parseFloat(r.overhead)) defaults.config.overheadPct = parseFloat(r.overhead);
      if (parseFloat(r.margin)) defaults.config.marginPct = parseFloat(r.margin);
    }
    const savedPresets = localStorage.getItem(getUserStorageKey('labour_presets'));
    if (savedPresets) {
      const presets: { name: string; rate: string }[] = JSON.parse(savedPresets);
      presets.forEach(p => {
        if (p.name && parseFloat(p.rate)) defaults.labourRates[p.name] = parseFloat(p.rate);
      });
    }
  } catch { /* corrupted settings: fall back to built-in defaults */ }
  return defaults;
}
