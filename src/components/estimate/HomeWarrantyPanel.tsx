import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import { homeWarranty, type HwSettings } from '@/lib/pricing/homeWarranty';

const money = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DEFAULTS: HwSettings = { include: false, work: 'new' };

export function readHomeWarranty(project: any): HwSettings {
  return { ...DEFAULTS, ...(project?.home_warranty ?? {}) };
}

function saveHomeWarranty(projectId: string, settings: HwSettings) {
  const key = getUserStorageKey('local_projects');
  const projects: any[] = JSON.parse(localStorage.getItem(key) || '[]');
  const idx = projects.findIndex(p => p.id === projectId);
  if (idx === -1) return;
  projects[idx].home_warranty = settings;
  localStorage.setItem(key, JSON.stringify(projects));
  syncProjectToSupabase(projects[idx]);
  window.dispatchEvent(new CustomEvent('home-warranty-changed', { detail: { projectId } }));
}

/**
 * Under the estimate total: the home warranty insurance this job needs in its state, worked
 * out from the total incl GST, with a switch to add it to the quote or leave it out.
 */
export function HomeWarrantyPanel({ projectId, state, totalIncGst }: { projectId: string; state: string; totalIncGst: number }) {
  const [s, setS] = useState<HwSettings>(DEFAULTS);
  const [amountDraft, setAmountDraft] = useState('');
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]').find((x: any) => x.id === projectId);
      const hw = readHomeWarranty(p);
      setS(hw);
      setAmountDraft(hw.amount != null ? String(hw.amount) : '');
    } catch { /* defaults */ }
  }, [projectId]);
  const update = (patch: Partial<HwSettings>) => { const next = { ...s, ...patch }; setS(next); saveHomeWarranty(projectId, next); };

  const r = homeWarranty(state, totalIncGst, s);
  const isQld = r.rule.state === 'QLD';
  const noScheme = !Number.isFinite(r.rule.thresholdIncGst);

  return (
    <Card className="mt-4 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">Home warranty insurance</p>
        <p className="text-xs text-muted-foreground">{r.rule.scheme} ({r.rule.state})</p>
      </div>
      {noScheme ? (
        <p className="mt-1 text-muted-foreground">{r.rule.note}</p>
      ) : (
        <>
          <p className={r.required ? 'mt-1 text-amber-400' : 'mt-1 text-muted-foreground'}>
            {r.required
              ? `Required: the contract is over ${money(r.rule.thresholdIncGst)} incl. GST.`
              : `Not required: the contract is ${money(r.rule.thresholdIncGst)} or less incl. GST.`}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[auto_auto_1fr] sm:items-end">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Work</span>
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={s.work}
                onChange={e => update({ work: e.target.value as HwSettings['work'] })}>
                <option value="new">New home</option>
                <option value="renovation">Renovation, extension or other work</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Your premium (from your insurer's quote)</span>
              <Input className="h-9 w-48 font-mono" inputMode="decimal" placeholder={isQld ? 'QBCC table' : 'Leave empty to estimate'}
                value={amountDraft} onChange={e => setAmountDraft(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(amountDraft.replace(/[$,\s]/g, ''));
                  update({ amount: amountDraft.trim() === '' || isNaN(v) ? null : v });
                }} />
            </label>
            <p className="text-xs text-muted-foreground sm:pb-2">
              {r.basis === 'table' && `${money(r.premium)} from the QBCC premium table for ${money(totalIncGst)}.`}
              {r.basis === 'rate' && `${money(r.premium)} estimated at ${s.ratePct ?? r.rule.typicalPct}% of the contract. Enter your real premium when you have it.`}
              {r.basis === 'amount' && `${money(r.premium)} as entered.`}
              {r.basis === 'none' && 'Nothing to add.'}
              {' '}{r.rule.note}
            </p>
          </div>
          {r.premium > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={s.include} onChange={e => update({ include: e.target.checked })} />
                Add {money(r.premium)} to the quote, after GST
              </label>
              <span>
                Total with insurance <span className="ml-1 font-mono font-semibold text-primary">{money(totalIncGst + r.premium)}</span>
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
