import { roundCents } from "./estimatePricing";

export interface PricedLine {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

/** A quote line's amount as printed: qty x unit price, to the cent. */
export const lineAmount = (l: { qty: number; unitPrice: number }): number => roundCents(l.qty * l.unitPrice);

/**
 * A quote's ex-GST subtotal: the printed line amounts added up. Every screen that totals
 * quote lines (quote, saved copies, client approval link, contract) uses this, so the
 * figures a client can add up on paper always match the subtotal.
 */
export const shownTotal = (lines: { qty: number; unitPrice: number }[]): number =>
  roundCents(lines.reduce((sum, l) => sum + lineAmount(l), 0));

/**
 * Scale line prices so the quote adds up to the estimate's ex-GST total exactly.
 * Unit prices are rounded to cents, so qty x price leaves a few cents over. Those go on
 * a single-quantity line when there is one; otherwise a "Rounding" line carries them,
 * so the quote total always equals the estimate to the cent.
 */
export function scaleLinesToTotal<T extends PricedLine>(lines: T[], target: number): T[] {
  const base = shownTotal(lines);
  if (!(target > 0) || !(base > 0)) return lines;
  const factor = target / base;
  const scaled = lines.map(l => ({ ...l, unitPrice: roundCents(l.unitPrice * factor) }));
  const residual = roundCents(target - shownTotal(scaled));
  if (Math.abs(residual) < 0.005) return scaled;
  const absorber = scaled.find(l => l.qty === 1);
  if (absorber) {
    absorber.unitPrice = roundCents(absorber.unitPrice + residual);
    return scaled;
  }
  const template = scaled[0];
  return [...scaled, { ...template, id: "rounding", description: "Rounding", qty: 1, unit: "item", unitPrice: residual, trade: "Project Costs" }];
}
