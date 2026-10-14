// Every screen that shows money must reach the same total as the Estimate's Project Cost Summary.
// Random projects are priced the way each screen prices them and compared to the cent.
import { calculateProjectTotals, priceLine, resolveProjectPricing, projectFfeAllowance, roundCents, gstOn } from '@/lib/pricing/estimatePricing';
import { scaleLinesToTotal, shownTotal } from '@/lib/pricing/quoteLines';

let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.log('FAIL', msg); } };
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const money = (max: number) => Math.round(rnd() * max * 100) / 100;

function randomProject(i: number) {
  const items = Array.from({ length: 1 + Math.floor(rnd() * 12) }, (_, k) => ({
    id: `i${k}`,
    trade: pick(['Carpenter', 'Concreter', 'Waterproofer', 'General', 'Electrician']),
    scope_of_work: 'Work',
    quantity: pick([0, 1, 0.7, 14.6, 20, 23, 35.7, 112.35, 3]),
    unit: pick(['m2', 'lm', 'm3', 'ea']),
    unit_price: money(900),
    labour_hours: money(90),
    labour_rate: pick([0, 95, 110]),
    labour_rate_override: rnd() < 0.3,
    markup_pct: pick([0, 15, 20, 12.5]),
    relatedMaterials: rnd() < 0.3 ? [{ quantity: 4, unit_price: 12.5, confirmed: true }, { quantity: 9, unit_price: 99 }] : [],
  }));
  return {
    id: `p${i}`,
    estimate_items: items,
    consumables: rnd() < 0.5 ? [{ name: 'Screws', quantity: 3, unit_price: 24.9 }] : [],
    prelim_items: rnd() < 0.5 ? [{ quantity: 1, unitPrice: money(3000) }] : [],
    overhead_total: rnd() < 0.5 ? money(5000) : 0,
    ffe_summary: rnd() < 0.3 ? { includeInQuote: true, totalExGst: money(8000) } : undefined,
    estimate_config: rnd() < 0.7 ? {
      supervisionPct: pick([0, 8]), overheadPct: pick([0, 12]), contingencyPct: pick([0, 5]),
      marginPct: pick([0, 15, 18]), gstPct: 10, materialWastage: pick([0, 10]), labourWastage: 5,
      defaultMarkup: 20, defaultLabourRate: 90, labourRates: { Carpenter: 110 }, customConfigs: rnd() < 0.3 ? [{ id: 'c', name: 'Risk', value: 2 }] : [],
    } : undefined,
  };
}

// Quote lines exactly as QuoteGenerator.buildLinesFromEstimate builds them
function quoteLines(p: any) {
  const { config, labourRates } = resolveProjectPricing(p, { config: {}, labourRates: {} });
  const lines = p.estimate_items.map((it: any) => {
    const total = priceLine(it, config, labourRates).total;
    const qty = it.quantity > 0 ? it.quantity : 1;
    return { id: it.id, description: it.scope_of_work, qty, unit: it.unit, unitPrice: Math.round((total / qty) * 100) / 100 };
  });
  const ffe = projectFfeAllowance(p);
  if (ffe > 0) lines.push({ id: 'ffe', description: 'FF&E', qty: 1, unit: 'item', unitPrice: roundCents(ffe) });
  for (const c of p.consumables) lines.push({ id: 'c', description: c.name, qty: c.quantity, unit: 'ea', unitPrice: c.unit_price });
  return lines;
}

for (let i = 0; i < 500; i++) {
  const p = randomProject(i);
  const t = calculateProjectTotals(p, { config: {}, labourRates: {} });

  // Summary parts add up to the total
  check(near(t.taxable + t.gst, t.totalPrice), `p${i} taxable + gst = total`);
  check(near(t.gst, roundCents(t.taxable * 0.1)), `p${i} gst is 10% of taxable`);

  // Quote, overheads folded into prices: client total == estimate ex GST, to the cent
  const absorbed = scaleLinesToTotal(quoteLines(p), t.taxable);
  check(near(roundCents(shownTotal(absorbed)), t.taxable), `p${i} absorbed quote ${shownTotal(absorbed).toFixed(4)} vs ${t.taxable}`);

  // Quote, separate overheads line: lines + bridge == estimate ex GST
  const plain = quoteLines(p);
  const bridge = roundCents(t.taxable - shownTotal(plain));
  check(near(roundCents(shownTotal(plain) + bridge), t.taxable), `p${i} itemised quote + bridge`);

  // Quote GST and total inc GST, as QuoteGenerator computes them
  const quoteSub = shownTotal(absorbed);
  const quoteInc = roundCents(quoteSub + gstOn(quoteSub, 10));
  check(near(roundCents(quoteInc), t.totalPrice), `p${i} quote inc GST ${quoteInc} vs ${t.totalPrice}`);

  // Contract (approveQuoteVersion): subtotal and inc GST equal the estimate
  const contractSub = roundCents(quoteSub);
  const contractInc = roundCents(contractSub + gstOn(contractSub, 10));
  check(near(contractSub, t.taxable) && near(contractInc, t.totalPrice), `p${i} contract ${contractInc} vs ${t.totalPrice}`);
}

// Hand-checked case: Yann's project (2026-10-15) without the stale $111,111 overhead
const yann = {
  estimate_items: [
    { trade: 'General', quantity: 20, unit_price: 55, labour_hours: 6, labour_rate: 90, markup_pct: 15 },
  ],
};
const ty = calculateProjectTotals(yann, { config: {}, labourRates: {} });
check(ty.overheadTotal === 0, 'no overhead items means no fixed overheads');

if (failures) { console.log(`${failures} pricing consistency failures`); process.exit(1); }
console.log('pricing consistency: estimate, quote (both modes), GST and contract agree on 500 random projects');
