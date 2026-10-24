import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  xeroStatus, xeroStartConnect, xeroDisconnect, xeroSaveSettings, xeroOptions,
  type XeroStatus, type XeroAccount, type XeroTheme, type XeroCodes,
} from '@/lib/xero/client';

const KINDS: { key: keyof XeroCodes; label: string; hint: string }[] = [
  { key: 'work', label: 'Work claimed', hint: 'Stage and trade lines on progress claims' },
  { key: 'variation', label: 'Variations', hint: 'Approved variation lines' },
  { key: 'deposit', label: 'Deposit', hint: 'The deposit, and taking it off the first claim' },
  { key: 'retention', label: 'Retention', hint: 'Retention held back, and released' },
];

const selectCls = 'h-9 w-full rounded-md border border-border bg-background px-2 text-sm';

/** The builder's Xero accounts as options: income first, then liability (for deposits or retention held). */
export function AccountSelect({ accounts, value, onChange, emptyLabel }: {
  accounts: XeroAccount[]; value: string; onChange: (v: string) => void; emptyLabel?: string;
}) {
  const known = accounts.some(a => a.code === value);
  return (
    <select className={selectCls} value={value} onChange={e => onChange(e.target.value)}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {value && !known && <option value={value}>{value}</option>}
      {['REVENUE', 'LIABILITY'].map(cls => {
        const list = accounts.filter(a => a.class === cls);
        if (!list.length) return null;
        return (
          <optgroup key={cls} label={cls === 'REVENUE' ? 'Income' : 'Liability'}>
            {list.map(a => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}

/** Settings > Xero: connect the builder's Xero, accounts per kind of line, branding theme, days to pay. */
export function XeroSettings() {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<XeroAccount[]>([]);
  const [themes, setThemes] = useState<XeroTheme[]>([]);
  const [account, setAccount] = useState('200');
  const [codes, setCodes] = useState<XeroCodes>({});
  const [themeId, setThemeId] = useState('');
  const [days, setDays] = useState('10');

  const load = async () => {
    try {
      const s = await xeroStatus();
      setStatus(s); setProblem('');
      if (s.accountCode) setAccount(s.accountCode);
      setCodes(s.accountCodes ?? {});
      setThemeId(s.brandingThemeId ?? '');
      if (s.dueDays != null) setDays(String(s.dueDays));
      if (s.connected) {
        const o = await xeroOptions().catch(() => null);
        if (o) { setAccounts(o.accounts); setThemes(o.brandingThemes); }
      }
    } catch (e) {
      setStatus({ connected: false });
      setProblem(e instanceof Error ? e.message : 'Xero did not respond');
    }
  };
  useEffect(() => { load(); }, []);

  const run = async (f: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try { await f(); if (done) toast.success(done); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Xero did not respond'); }
    finally { setBusy(false); }
  };

  const name = status?.tenantName || 'your organisation';

  return (
    <Card className="border-border bg-card">
      <CardHeader><CardTitle>Xero</CardTitle></CardHeader>
      <CardContent className="space-y-5 text-sm">
        <p className="text-muted-foreground">
          Deposits and progress claims go into Xero as draft invoices, priced exactly as claimed. Nothing reaches your client until you approve and send it in Xero.
        </p>
        {status === null ? (
          <p className="text-muted-foreground">Checking...</p>
        ) : status.connected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span>Invoices go to <span className="font-medium">{name}</span></span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => xeroStartConnect())}>Change organisation</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(xeroDisconnect, 'Xero disconnected')}>Disconnect</Button>
              </span>
            </div>

            <div className="space-y-2">
              <p className="font-medium">Accounts</p>
              <p className="text-xs text-muted-foreground">From {name}'s chart of accounts. Each kind of line can go to its own account; leave one on "Main income account" to use the first. You can still change any line before sending.</p>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Main income account</span>
                <AccountSelect accounts={accounts} value={account} onChange={setAccount} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {KINDS.map(k => (
                  <label key={k.key} className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{k.label} <span className="opacity-70">({k.hint})</span></span>
                    <AccountSelect accounts={accounts} value={codes[k.key] ?? ''} emptyLabel="Main income account"
                      onChange={v => setCodes(c => ({ ...c, [k.key]: v || undefined }))} />
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Invoice look (Xero branding theme)</span>
                <select className={selectCls} value={themeId} onChange={e => setThemeId(e.target.value)}>
                  <option value="">{name}'s default</option>
                  {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Days to pay</span>
                <Input inputMode="numeric" value={days} onChange={e => setDays(e.target.value)} placeholder="10" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              The logo, ABN, address and payment details on the invoice come from the branding theme in Xero (Settings, Invoice settings). GST is charged as GST on Income.
            </p>
            <Button size="sm" disabled={busy}
              onClick={() => run(() => xeroSaveSettings({ accountCode: account, accountCodes: codes, brandingThemeId: themeId || null, dueDays: Number(days) }), 'Saved')}>
              Save
            </Button>
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
