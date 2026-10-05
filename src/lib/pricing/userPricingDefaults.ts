import { getUserStorageKey } from '@/lib/localAuth';
import type { UserPricingDefaults } from './estimatePricing';

/**
 * The estimator's own defaults from Settings → Rates. They apply to any project
 * that hasn't saved its own pricing config yet.
 */
export function readUserPricingDefaults(): UserPricingDefaults {
  const defaults: UserPricingDefaults = { config: {}, labourRates: {} };
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
