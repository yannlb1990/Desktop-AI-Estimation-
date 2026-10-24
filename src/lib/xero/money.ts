/**
 * Where the money is on a job: what has been claimed, what the client has paid (read back
 * from Xero), what is owing and what is left to claim. Amounts include GST, as on invoices.
 */
import type { ProgressClaimRecord } from '@/lib/contract';
import { roundCents } from '@/lib/pricing/estimatePricing';

export type XeroInvoiceState = NonNullable<ProgressClaimRecord['xero']>;

export interface JobMoney {
  contractIncGst: number;
  claimedIncGst: number;
  paidIncGst: number;
  /** issued in Xero and not yet paid */
  owingIncGst: number;
  overdueIncGst: number;
  /** still in Xero as a draft, or not sent to Xero yet */
  notIssuedIncGst: number;
  leftToClaimIncGst: number;
  retentionHeldExGst: number;
}

const issued = (x?: XeroInvoiceState) => !!x && ['AUTHORISED', 'PAID'].includes(x.status ?? '');
const gone = (x?: XeroInvoiceState) => !!x && ['VOIDED', 'DELETED'].includes(x.status ?? '');

export function isOverdue(x: XeroInvoiceState | undefined, today = new Date().toISOString().slice(0, 10)): boolean {
  return !!x && x.status === 'AUTHORISED' && (x.amountDue ?? 0) > 0.004 && !!x.dueDate && x.dueDate < today;
}

export function jobMoney(contractIncGst: number, claims: ProgressClaimRecord[], today?: string): JobMoney {
  let claimed = 0, paid = 0, owing = 0, overdue = 0, notIssued = 0;
  for (const c of claims) {
    if (gone(c.xero)) continue; // voided or deleted in Xero: not claimed any more
    claimed += c.thisClaimIncGst;
    if (issued(c.xero)) {
      paid += c.xero!.amountPaid ?? 0;
      const due = c.xero!.amountDue ?? 0;
      owing += due;
      if (isOverdue(c.xero, today)) overdue += due;
    } else {
      notIssued += c.thisClaimIncGst;
    }
  }
  const lastProgress = [...claims].reverse().find(c => !c.kind);
  return {
    contractIncGst: roundCents(contractIncGst),
    claimedIncGst: roundCents(claimed),
    paidIncGst: roundCents(paid),
    owingIncGst: roundCents(owing),
    overdueIncGst: roundCents(overdue),
    notIssuedIncGst: roundCents(notIssued),
    leftToClaimIncGst: roundCents(contractIncGst - claimed),
    retentionHeldExGst: roundCents(lastProgress?.retentionHeld ?? 0),
  };
}

const money = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-AU') : '');

/** One line for an invoice's state in Xero, and how loud to show it. */
export function xeroStateLabel(x: XeroInvoiceState | undefined, today?: string): { text: string; tone: 'done' | 'wait' | 'late' | 'muted' } | null {
  if (!x) return null;
  const n = x.number ?? 'Invoice';
  switch (x.status) {
    case 'PAID': return { text: `${n} paid${x.paidOn ? ` ${day(x.paidOn)}` : ''}`, tone: 'done' };
    case 'AUTHORISED':
      if ((x.amountPaid ?? 0) > 0.004) return { text: `${n} part paid, $${money(x.amountDue ?? 0)} owing`, tone: isOverdue(x, today) ? 'late' : 'wait' };
      if (isOverdue(x, today)) return { text: `${n} overdue since ${day(x.dueDate)}`, tone: 'late' };
      return { text: `${n} awaiting payment${x.dueDate ? `, due ${day(x.dueDate)}` : ''}`, tone: 'wait' };
    case 'SUBMITTED': return { text: `${n} waiting for approval in Xero`, tone: 'muted' };
    case 'VOIDED': return { text: `${n} voided in Xero`, tone: 'muted' };
    case 'DELETED': return { text: `${n} deleted in Xero`, tone: 'muted' };
    default: return { text: `${n} draft in Xero`, tone: 'muted' };
  }
}
