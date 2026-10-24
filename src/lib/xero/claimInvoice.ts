/**
 * A deposit or progress claim as invoice lines, in the client's terms: one line per stage
 * (trade or variation) for the work done since the last claim, then retention, then the
 * deposit coming off. The lines always add up to exactly what the claim says is due.
 */
import type { ProgressClaimRecord } from '@/lib/contract';
import { roundCents } from '@/lib/pricing/estimatePricing';

/** which default account a line uses: deposit coming off goes back to the deposit account */
export type InvoiceLineKind = 'deposit' | 'work' | 'variation' | 'retention';
export interface InvoiceLine { description: string; amount: number; kind: InvoiceLineKind; accountCode?: string }

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;
const money = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The usual cap on a deposit for domestic building work in QLD: 10% under $20,000, else 5%. */
export function depositCapPct(contractExGst: number): number {
  return contractExGst < 20000 ? 10 : 5;
}

export function claimInvoiceLines(record: ProgressClaimRecord, allClaims: ProgressClaimRecord[], quoteNumber?: string): InvoiceLine[] {
  const quote = quoteNumber ? `, quote ${quoteNumber}` : '';
  if (record.kind === 'deposit') {
    return [{ description: `Deposit: ${pct(record.depositPct ?? 0)} of the contract sum of $${money(record.contractExGst ?? 0)} ex GST${quote}`, amount: record.thisClaimExGst, kind: 'deposit' }];
  }
  const before = allClaims.slice(0, Math.max(0, allClaims.findIndex(c => c.id === record.id)));
  const lastProgress = [...before].reverse().find(c => c.kind !== 'deposit');
  const lastPct = new Map((lastProgress?.stages ?? []).map(s => [s.id, s.percentComplete || 0]));

  const lines: InvoiceLine[] = [];
  for (const st of record.stages) {
    const was = lastPct.get(st.id) ?? 0;
    const amount = roundCents((st.value || 0) * (((st.percentComplete || 0) - was) / 100));
    if (Math.abs(amount) < 0.005) continue;
    lines.push({
      description: `${st.name}: ${pct(st.percentComplete || 0)} complete to date${was ? ` (${pct(was)} claimed before)` : ''}`,
      amount,
      kind: st.id.startsWith('vo-') ? 'variation' : 'work',
    });
  }
  const retentionNow = roundCents(record.retentionHeld - (lastProgress?.retentionHeld ?? 0));
  if (Math.abs(retentionNow) >= 0.005) {
    lines.push(retentionNow > 0
      ? { description: `Less retention (${pct(record.retentionPct)} of work completed)`, amount: -retentionNow, kind: 'retention' as const }
      : { description: `Retention released (now ${pct(record.retentionPct)} of work completed)`, amount: -retentionNow, kind: 'retention' as const });
  }
  // whatever is left is money already invoiced: the deposit the first time, rounding after
  const rest = roundCents(record.thisClaimExGst - lines.reduce((s, l) => s + l.amount, 0));
  if (Math.abs(rest) >= 0.005) {
    const depositNow = !lastProgress && before.some(c => c.kind === 'deposit');
    lines.push({ description: depositNow ? 'Less deposit already invoiced' : 'Adjustment for amounts claimed before', amount: rest, kind: depositNow ? 'deposit' : 'work' });
  }
  if (!lines.length) lines.push({ description: `Progress claim ${record.number}${quote}`, amount: record.thisClaimExGst, kind: 'work' });
  return lines;
}

export function claimReference(record: ProgressClaimRecord, quoteNumber?: string, siteAddress?: string): string {
  const what = record.kind === 'deposit' ? 'Deposit' : `Progress claim ${record.number}`;
  return [what, quoteNumber ? `quote ${quoteNumber}` : '', siteAddress || ''].filter(Boolean).join(', ');
}
