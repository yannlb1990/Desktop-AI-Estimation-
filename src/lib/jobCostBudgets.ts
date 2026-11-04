import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { normaliseTrade, sumByTrade } from '@/lib/trades';
import { priceLine, resolveProjectPricing } from '@/lib/pricing/estimatePricing';
import { readUserPricingDefaults } from '@/lib/pricing/userPricingDefaults';

/** The estimate's cost (before markup) per trade: the budgets Job Cost starts with. */
export function estimateBudgets(project: any): Record<string, number> {
  const { config, labourRates } = resolveProjectPricing(project, readUserPricingDefaults(project));
  const out: Record<string, number> = {};
  for (const item of project?.estimate_items ?? []) {
    const t = normaliseTrade(item.trade);
    if (t) out[t] = Math.round(((out[t] || 0) + priceLine(item, config, labourRates).subtotal) * 100) / 100;
  }
  return out;
}

const KEY = (pid: string) => getUserStorageKey(`job_cost_budgets_${pid}`);

/** A trade's Job Cost budget (what it should cost you, ex GST), saved where Job Cost reads it. */
export function setTradeBudget(projectId: string, trade: string, amount: number): void {
  let budgets: Record<string, number> = {};
  try { budgets = sumByTrade(JSON.parse(localStorage.getItem(KEY(projectId)) || '{}')); } catch { /* start empty */ }
  const projects: any[] = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]');
  const idx = projects.findIndex(p => p.id === projectId);
  if (!Object.keys(budgets).length && idx !== -1 && projects[idx].trade_budgets) budgets = sumByTrade(projects[idx].trade_budgets);
  // No budgets yet: start from the estimate's cost for every trade, as Job Cost does on first open
  if (!Object.keys(budgets).length && idx !== -1) budgets = estimateBudgets(projects[idx]);
  budgets[normaliseTrade(trade)] = Math.round(amount * 100) / 100;
  localStorage.setItem(KEY(projectId), JSON.stringify(budgets));
  if (idx !== -1) {
    projects[idx].trade_budgets = budgets;
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
    syncProjectToSupabase(projects[idx]);
  }
}
