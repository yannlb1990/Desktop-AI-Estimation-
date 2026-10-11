/** Whole-estimate exports that sit next to "Export to Excel". */
import { toast } from 'sonner';
import { exportToBOQCsv } from '@/lib/takeoff/export';
import { calculateProjectTotals, resolveProjectPricing } from '@/lib/pricing/estimatePricing';
import { readUserPricingDefaults } from '@/lib/pricing/userPricingDefaults';
import { estimateLinesAsCostItems } from './fromCostItem';

export const projectStateCode = (project: any): string =>
  (String(project?.site_address || project?.address || '').match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i)?.[1] || project?.state || 'NSW').toUpperCase();

/** BOQ CSV of the estimate, totals identical to the Estimate and the quote. */
export function downloadEstimateBOQ(project: any): void {
  const items = estimateLinesAsCostItems(project);
  if (items.length === 0) { toast.error('The estimate has no lines yet'); return; }
  const defaults = readUserPricingDefaults(project);
  const { config } = resolveProjectPricing(project, defaults);
  const t = calculateProjectTotals(project, defaults);
  const linesTotal = items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
  const csv = exportToBOQCsv({
    projectName: project?.name || 'Project',
    projectLocation: project?.site_address || project?.address || '',
    state: projectStateCode(project),
    costItems: items,
    estimateTotals: {
      rows: [
        { label: 'SUPERVISION, OVERHEADS, PRELIMINARIES AND ALLOWANCES', amount: t.preMargin - linesTotal },
        { label: `CONTINGENCY (${config.contingencyPct}%)`, amount: t.contingency },
        { label: 'OTHER ADJUSTMENTS', amount: t.customConfigsTotal },
        { label: `MARGIN (${config.marginPct}%)`, amount: t.margin },
      ],
      exGst: t.taxable,
      gst: t.gst,
      gstPct: config.gstPct,
      incGst: t.totalPrice,
    },
  });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `BOQ_${(project?.name || 'project').replace(/[^\w-]+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
