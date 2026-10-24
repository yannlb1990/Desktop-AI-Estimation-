import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { xeroStatus, xeroStartConnect, xeroDisconnect, xeroSaveSettings, type XeroStatus } from '@/lib/xero/client';

/** Settings > Xero: connect the builder's Xero, choose the income account and days to pay. */
export function XeroSettings() {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState('200');
  const [days, setDays] = useState('10');

  const load = () => xeroStatus()
    .then(s => { setStatus(s); setProblem(''); if (s.accountCode) setAccount(s.accountCode); if (s.dueDays != null) setDays(String(s.dueDays)); })
    .catch(e => { setStatus({ connected: false }); setProblem(e instanceof Error ? e.message : 'Xero did not respond'); });
  useEffect(() => { load(); }, []);

  const run = async (f: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try { await f(); if (done) toast.success(done); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Xero did not respond'); }
    finally { setBusy(false); }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader><CardTitle>Xero</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          Deposits and progress claims go into your Xero as draft invoices, priced exactly as claimed. Nothing reaches your client until you approve and send it in Xero.
        </p>
        {status === null ? (
          <p className="text-muted-foreground">Checking...</p>
        ) : status.connected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span>Connected to <span className="font-medium">{status.tenantName}</span></span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => xeroStartConnect())}>Change organisation</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(xeroDisconnect, 'Xero disconnected')}>Disconnect</Button>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Income account code in Xero</span>
                <Input value={account} onChange={e => setAccount(e.target.value)} placeholder="200" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Days to pay</span>
                <Input inputMode="numeric" value={days} onChange={e => setDays(e.target.value)} placeholder="10" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">Lines use this account with GST on Income. Check the code in Xero under Accounting, Chart of accounts.</p>
            <Button size="sm" disabled={busy} onClick={() => run(() => xeroSaveSettings(account, Number(days)), 'Saved')}>Save</Button>
          </>
        ) : (
          <>
            {problem && <p className="text-amber-400">{problem}</p>}
            <Button disabled={busy || /not set up/i.test(problem)} onClick={() => run(() => xeroStartConnect())}>Connect Xero</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
