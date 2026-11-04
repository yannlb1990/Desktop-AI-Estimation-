/**
 * Awarding a trade to a subcontractor: their price replaces your estimate for that trade.
 * The trade's lines are scaled so their cost (before markup) equals the quote exactly,
 * keeping every line, room and quantity, instead of adding the quote as an extra line on
 * top (which counted the trade twice). Money goes through the shared pricing module.
 */
import { priceLine, type PricingConfig, type PricingItem } from '@/lib/pricing/estimatePricing';
import { normaliseTrade } from '@/lib/trades';

type Line = PricingItem & { id: string; trade: string; [k: string]: any };

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Your estimate's cost for a trade: materials and labour with waste, before markup. */
export function tradeCost(items: Line[], trade: string, config: PricingConfig, rates: Record<string, number>): number {
  const t = normaliseTrade(trade);
  return Math.round(items.filter(i => normaliseTrade(i.trade) === t)
    .reduce((s, i) => s + priceLine(i, config, rates).subtotal, 0) * 100) / 100;
}

/**
 * The estimate with a trade's lines brought to the quote's price. With no lines for the
 * trade yet, the quote goes in as one lump sum line. Lines keep their markup.
 */
export function applySubbieQuote(
  items: Line[], trade: string, quoteExGst: number, company: string,
  config: PricingConfig, rates: Record<string, number>,
  opts: { markupPct?: number; area?: string } = {},
): Line[] {
  const t = normaliseTrade(trade);
  const current = tradeCost(items, t, config, rates);
  if (current <= 0) {
    return [...items, {
      id: `subbie-${Date.now()}`,
      section_id: null,
      area: opts.area ?? '',
      trade: t,
      scope_of_work: `${t} as per ${company} quote`,
      material_type: 'Supply and install',
      quantity: 1,
      unit: 'item',
      unit_price: Math.round(quoteExGst * 100) / 100,
      labour_hours: 0,
      labour_rate: 0,
      material_wastage_pct: 0,
      labour_wastage_pct: 0,
      markup_pct: opts.markupPct ?? config.defaultMarkup,
      notes: '',
      awarded_to: company,
    } as Line];
  }
  const f = quoteExGst / current;
  return items.map(i => {
    if (normaliseTrade(i.trade) !== t) return i;
    const rate = priceLine(i, config, rates).labourRate;
    return {
      ...i,
      unit_price: r4((i.unit_price || 0) * f),
      ...(i.labour_hours ? { labour_rate: r4(rate * f), labour_rate_override: true } : {}),
      relatedMaterials: (i.relatedMaterials || []).map((rm: any) => ({ ...rm, unit_price: r4((rm.unit_price || 0) * f) })),
      awarded_to: company,
    };
  });
}
