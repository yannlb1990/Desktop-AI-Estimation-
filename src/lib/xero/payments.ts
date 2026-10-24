/**
 * Payments made in Xero, brought back onto the claims they belong to (by claim id), so a
 * claim shows paid, part paid or overdue, and the job's money adds up.
 */
import { getUserStorageKey } from '@/lib/localAuth';
import { saveProgressClaims, type ProgressClaimRecord } from '@/lib/contract';
import { xeroSync, xeroStatus, type XeroSyncedInvoice } from './client';

const same = (a: any, b: any) => ['status', 'amountPaid', 'amountDue', 'dueDate', 'paidOn', 'number'].every(k => (a?.[k] ?? null) === (b?.[k] ?? null));

/** Apply what Xero says; returns the ids of projects that changed. */
export function applyXeroInvoices(invoices: XeroSyncedInvoice[]): string[] {
  const bySource = new Map(invoices.map(i => [i.sourceId, i]));
  let projects: any[] = [];
  try { projects = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]'); } catch { return []; }
  const changed: string[] = [];
  for (const p of projects) {
    const claims: ProgressClaimRecord[] = p.progress_claims ?? [];
    let touched = false;
    const next = claims.map(c => {
      const inv = c.xero ? bySource.get(c.id) : undefined;
      if (!inv || inv.invoiceId !== c.xero!.invoiceId) return c;
      const fresh = { status: inv.status, amountPaid: inv.amountPaid, amountDue: inv.amountDue, dueDate: inv.dueDate, paidOn: inv.paidOn, number: inv.number ?? c.xero!.number };
      if (same(c.xero, fresh)) return c;
      touched = true;
      return { ...c, xero: { ...c.xero!, ...fresh, total: inv.total ?? c.xero!.total, checkedAt: new Date().toISOString() } };
    });
    if (touched) { saveProgressClaims(p.id, next); changed.push(p.id); }
  }
  return changed;
}

/** Ask Xero about a project's invoices (or all), and apply. Quietly does nothing without Xero. */
export async function refreshXeroPayments(projectId?: string): Promise<string[]> {
  const s = await xeroStatus().catch(() => null);
  if (!s?.connected) return [];
  const { invoices } = await xeroSync(projectId);
  return applyXeroInvoices(invoices);
}
