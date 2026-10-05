/**
 * Single source of truth for estimate pricing.
 *
 * The Estimate tab, the Costs tab "Send to Estimate" snapshot and the Quote
 * Generator all price from these functions. Before this module each screen had
 * its own formula, so the same project showed different totals depending on
 * which screen was opened last.
 */

export interface PricingRelatedMaterial {
  quantity?: number;
  unit_price?: number;
  confirmed?: boolean;
  /** set by the Costs tab when the estimator accepted the suggestion */
  isAccepted?: boolean;
}

export interface PricingItem {
  trade: string;
  quantity: number;
  unit_price: number;
  labour_hours: number;
  labour_rate?: number;
  /** true when the estimator set this line's $/hr on purpose; the trade rate then no longer applies */
  labour_rate_override?: boolean;
  material_wastage_pct?: number | null;
  labour_wastage_pct?: number | null;
  markup_pct?: number | null;
  relatedMaterials?: PricingRelatedMaterial[];
}

export interface PricingConsumable {
  quantity?: number;
  unit_price?: number;
}

export interface PricingConfig {
  defaultLabourRate: number;
  materialWastage: number;
  labourWastage: number;
  contingencyPct: number;
  defaultMarkup: number;
  supervisionPct: number;
  overheadPct: number;
  marginPct: number;
  gstPct: number;
}

export const DEFAULT_LABOUR_RATES: Record<string, number> = {
  Carpenter: 90,
  Plumber: 95,
  Electrician: 100,
  Bricklayer: 85,
  Plasterer: 80,
  Painter: 75,
  Tiler: 85,
  Concreter: 90,
  Roofer: 95,
  Landscaper: 80,
};

export const DEFAULT_ESTIMATE_CONFIG: PricingConfig = {
  defaultLabourRate: 90,
  materialWastage: 10,
  labourWastage: 5,
  contingencyPct: 5,
  defaultMarkup: 20,
  supervisionPct: 8,
  overheadPct: 12,
  marginPct: 15,
  gstPct: 10,
};

/** A line's own rate wins only when it was overridden; otherwise the trade rate applies. */
export function resolveLabourRate(
  item: Pick<PricingItem, 'trade' | 'labour_rate' | 'labour_rate_override'>,
  labourRates: Record<string, number>,
  defaultLabourRate: number,
): number {
  if (item.labour_rate_override && item.labour_rate) return item.labour_rate;
  return labourRates[item.trade] || item.labour_rate || defaultLabourRate;
}

export interface LinePricing {
  labourRate: number;
  materialBase: number;
  materialWaste: number;
  relatedMaterials: number;
  /** material incl. waste and confirmed related materials */
  materials: number;
  labourBase: number;
  labourWaste: number;
  labour: number;
  subtotal: number;
  markup: number;
  total: number;
}

export function priceLine(
  item: PricingItem,
  config: PricingConfig,
  labourRates: Record<string, number>,
): LinePricing {
  const matWastePct = item.material_wastage_pct ?? config.materialWastage;
  const labWastePct = item.labour_wastage_pct ?? config.labourWastage;

  const materialBase = (item.quantity || 0) * (item.unit_price || 0);
  const materialWaste = materialBase * (matWastePct / 100);
  // Unconfirmed suggestions on a line aren't a cost yet and must not be charged.
  const relatedMaterials = (item.relatedMaterials || [])
    .filter(rm => rm.confirmed || rm.isAccepted)
    .reduce((sum, rm) => sum + (rm.quantity || 0) * (rm.unit_price || 0), 0);
  const materials = materialBase + materialWaste + relatedMaterials;

  const labourRate = resolveLabourRate(item, labourRates, config.defaultLabourRate);
  const labourBase = (item.labour_hours || 0) * labourRate;
  const labourWaste = labourBase * (labWastePct / 100);
  const labour = labourBase + labourWaste;

  const subtotal = materials + labour;
  const markup = subtotal * ((item.markup_pct || 0) / 100);

  return {
    labourRate,
    materialBase,
    materialWaste,
    relatedMaterials,
    materials,
    labourBase,
    labourWaste,
    labour,
    subtotal,
    markup,
    total: subtotal + markup,
  };
}

export interface EstimateTotals {
  totalMaterials: number;
  totalLabour: number;
  totalMarkup: number;
  baseSubtotal: number;
  supervision: number;
  overheadsPct: number;
  overheadTotal: number;
  totalOverheads: number;
  prelimsTotal: number;
  preMargin: number;
  contingency: number;
  customConfigsTotal: number;
  margin: number;
  taxable: number;
  gst: number;
  totalPrice: number;
}

export interface EstimateTotalsInput {
  items: PricingItem[];
  consumables?: PricingConsumable[];
  config: PricingConfig;
  labourRates: Record<string, number>;
  /** fixed $ overheads from the Overheads tab */
  overheadTotal?: number;
  prelimsTotal?: number;
  customConfigs?: { value: number }[];
}

export function calculateEstimateTotals({
  items,
  consumables = [],
  config,
  labourRates,
  overheadTotal = 0,
  prelimsTotal = 0,
  customConfigs = [],
}: EstimateTotalsInput): EstimateTotals {
  let totalMaterials = 0;
  let totalLabour = 0;
  let totalMarkup = 0;

  items.forEach(item => {
    const line = priceLine(item, config, labourRates);
    totalMaterials += line.materials;
    totalLabour += line.labour;
    totalMarkup += line.markup;
  });

  consumables.forEach(cons => {
    totalMaterials += (cons.quantity || 0) * (cons.unit_price || 0);
  });

  const baseSubtotal = totalMaterials + totalLabour;
  const supervision = totalLabour * (config.supervisionPct / 100);
  const overheadsPct = (baseSubtotal + supervision) * (config.overheadPct / 100);
  const totalOverheads = overheadsPct + overheadTotal;
  // Line markup sits inside preMargin, so contingency and margin apply on top of it.
  const preMargin = baseSubtotal + totalMarkup + supervision + totalOverheads + prelimsTotal;
  const contingency = preMargin * (config.contingencyPct / 100);
  const customConfigsTotal = customConfigs.reduce((sum, cc) => sum + preMargin * ((cc.value || 0) / 100), 0);
  const margin = preMargin * (config.marginPct / 100);
  const taxable = preMargin + contingency + customConfigsTotal + margin;
  const gst = taxable * (config.gstPct / 100);

  return {
    totalMaterials,
    totalLabour,
    totalMarkup,
    baseSubtotal,
    supervision,
    overheadsPct,
    overheadTotal,
    totalOverheads,
    prelimsTotal,
    preMargin,
    contingency,
    customConfigsTotal,
    margin,
    taxable,
    gst,
    totalPrice: taxable + gst,
  };
}

/**
 * Totals for a project exactly as the Estimate tab would show them, read from the
 * saved project object. Used where the Estimate tab isn't mounted (Costs transfer).
 */
export function calculateProjectTotals(project: any): EstimateTotals {
  const saved = project?.estimate_config || {};
  const { labourRates: savedRates, customConfigs, ...savedConfig } = saved;
  const prelimsTotal = (project?.prelim_items || []).reduce(
    (sum: number, p: any) => sum + (p.quantity || 0) * (p.unitPrice || 0),
    0,
  );
  return calculateEstimateTotals({
    items: project?.estimate_items || [],
    consumables: project?.consumables || [],
    config: { ...DEFAULT_ESTIMATE_CONFIG, ...savedConfig },
    labourRates: { ...DEFAULT_LABOUR_RATES, ...(savedRates || {}) },
    overheadTotal: project?.overhead_total || 0,
    prelimsTotal,
    customConfigs: customConfigs || [],
  });
}
