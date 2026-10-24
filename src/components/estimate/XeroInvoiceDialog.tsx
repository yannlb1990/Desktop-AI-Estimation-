import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AccountSelect } from '@/components/settings/XeroSettings';
import type { InvoiceLine } from '@/lib/xero/claimInvoice';
import type { XeroAccount, XeroStatus } from '@/lib/xero/client';
import { gstOn, roundCents } from '@/lib/pricing/estimatePricing';

const money = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  status: XeroStatus;
  accounts: XeroAccount[];
  clientName: string;
  reference: string;
  date: string;
  lines: InvoiceLine[];
  gstPct: number;
  /** already in Xero: sending updates that draft */
  existingNumber?: string;
  busy: boolean;
  onSend: (p: { reference: string; lines: InvoiceLine[] }) => void;
}

/**
 * The invoice as it will be in Xero, before it goes: wording and account per line can be
 * changed; amounts are the claim's, so the invoice always equals what was claimed.
 */
export function XeroInvoiceDialog({ open, onOpenChange, title, status, accounts, clientName, reference, date, lines, gstPct, existingNumber, busy, onSend }: Props) {
  const codeFor = (l: InvoiceLine) => l.accountCode || status.accountCodes?.[l.kind] || status.accountCode || '';
  const [rows, setRows] = useState<InvoiceLine[]>([]);
  const [ref, setRef] = useState(reference);
  useEffect(() => {
    if (!open) return;
    setRows(lines.map(l => ({ ...l, accountCode: codeFor(l) })));
    setRef(reference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const exGst = roundCents(rows.reduce((s, l) => s + l.amount, 0));
  const gst = gstOn(exGst, gstPct);
  const due = (() => {
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + (status.dueDays ?? 10));
    return d.toLocaleDateString('en-AU');
  })();
  const ready = rows.length > 0 && rows.every(r => r.description.trim() && r.accountCode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid gap-3 rounded-lg border border-border bg-card px-3 py-2 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">From</p>
              <p className="font-medium">{status.tenantName}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">To</p>
              <p className="font-medium">{clientName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p>{new Date(`${date}T00:00:00`).toLocaleDateString('en-AU')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due</p>
              <p>{due}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Status in Xero</p>
              <p>{existingNumber ? `Draft ${existingNumber}: this updates it` : 'New draft'}</p>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Reference (shows on the invoice)</span>
            <Input value={ref} maxLength={255} onChange={e => setRef(e.target.value)} />
          </label>

          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_12rem_7rem] gap-2 px-1 text-xs text-muted-foreground sm:grid">
              <span>Description</span><span>Account</span><span className="text-right">Amount ex GST</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-border px-2 py-2 sm:grid-cols-[1fr_12rem_7rem] sm:items-center">
                <textarea
                  rows={2}
                  className="w-full resize-y rounded-md border border-border bg-background px-2 py-1 text-sm"
                  value={r.description}
                  onChange={e => setRows(rs => rs.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)))}
                />
                <AccountSelect accounts={accounts} value={r.accountCode ?? ''}
                  onChange={v => setRows(rs => rs.map((x, k) => (k === i ? { ...x, accountCode: v } : x)))} />
                <span className={`text-right font-mono ${r.amount < 0 ? 'text-amber-400' : ''}`}>${money(r.amount)}</span>
              </div>
            ))}
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">${money(exGst)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST {gstPct}%</span><span className="font-mono">${money(gst)}</span></div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Total</span><span className="font-mono">${money(roundCents(exGst + gst))}</span></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Goes into Xero as a draft with {status.tenantName}'s branding. Approve and email it from Xero when you are happy with it.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!ready || busy} onClick={() => onSend({ reference: ref.trim(), lines: rows })}>
            {busy ? 'Sending...' : existingNumber ? `Update draft ${existingNumber}` : 'Create draft in Xero'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
