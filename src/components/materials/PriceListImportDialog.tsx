import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getUserStorageKey } from '@/lib/localAuth';
import { syncProjectToSupabase } from '@/lib/db/projects';
import type { MaterialEntry } from '@/lib/materials/types';
import {
  parseCSV, detectColumns, findHeaderRow, readPriceList, diffAgainstLibrary, estimateLinesToReprice,
  type PriceField, type EstimateLineChange,
} from '@/lib/materials/priceListImport';

interface Props {
  open: boolean;
  fileName: string;
  csvText: string;
  library: MaterialEntry[];
  onApply: (added: ReturnType<typeof readPriceList>['items'], changed: { id: string; unitCost: number }[], supplier: string) => void;
  onClose: () => void;
}

const FIELDS: { key: PriceField; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Description', required: true },
  { key: 'price', label: 'Price', required: true },
  { key: 'code', label: 'Product code' },
  { key: 'unit', label: 'Unit' },
  { key: 'trade', label: 'Trade' },
  { key: 'notes', label: 'Notes' },
];

const money = (n: number) => `$${n.toFixed(2)}`;
const pct = (from: number, to: number) => (from > 0 ? `${to >= from ? '+' : ''}${(((to - from) / from) * 100).toFixed(1)}%` : '');

const readProjects = (): any[] => {
  try { return JSON.parse(localStorage.getItem(getUserStorageKey('local_projects')) || '[]'); } catch { return []; }
};

export const PriceListImportDialog: React.FC<Props> = ({ open, fileName, csvText, library, onApply, onClose }) => {
  // The header may sit under a title or address block: start from it
  const rows = useMemo(() => { const all = parseCSV(csvText); return all.slice(findHeaderRow(all)); }, [csvText]);
  const headers = rows[0] ?? [];
  const [map, setMap] = useState<Partial<Record<PriceField, number>>>({});
  const [supplier, setSupplier] = useState('');
  const [incGst, setIncGst] = useState(false);
  const [trade, setTrade] = useState('General');
  const [step, setStep] = useState<'map' | 'estimates'>('map');
  const [repriceSnapshot, setRepriceSnapshot] = useState<{ lines: EstimateLineChange[]; lockedProjects: string[] }>({ lines: [], lockedProjects: [] });
  const [doneProjects, setDoneProjects] = useState<Set<string>>(new Set());
  // Typing a supplier name must not re-read a 20,000 row file on every key
  const supplierQ = useDeferredValue(supplier);

  useEffect(() => {
    if (!open) return;
    setMap(detectColumns(headers));
    setSupplier(fileName.replace(/\.(csv|txt)$/i, '').replace(/[-_]+/g, ' ').replace(/\s*(price\s*list|pricelist|prices)\s*/i, ' ').trim());
    const priceHeader = headers[detectColumns(headers).price ?? -1] ?? '';
    setIncGst(/inc(l|\.)?\s*gst|incl/i.test(priceHeader));
    setStep('map');
    setDoneProjects(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, csvText]);

  const { items, skipped } = useMemo(
    () => (map.name !== undefined || map.code !== undefined) && map.price !== undefined
      ? readPriceList(rows, map, { supplier: supplierQ, pricesIncludeGst: incGst, defaultTrade: trade || 'General' })
      : { items: [], skipped: Math.max(0, rows.length - 1) },
    [rows, map, supplierQ, incGst, trade]);
  const diff = useMemo(() => diffAgainstLibrary(items, library, supplierQ), [items, library, supplierQ]);

  // Worked out once when the prices are applied; updated jobs stay listed as Updated
  const reprice = repriceSnapshot;
  const byProject = useMemo(() => {
    const m = new Map<string, EstimateLineChange[]>();
    for (const l of reprice.lines) m.set(l.projectId, [...(m.get(l.projectId) ?? []), l]);
    return [...m.entries()];
  }, [reprice]);

  const apply = () => {
    onApply(diff.added, diff.changed.map(c => ({ id: c.existing.id, unitCost: c.to })), supplier.trim() || 'Supplier');
    toast.success(`${diff.added.length} new material${diff.added.length !== 1 ? 's' : ''}, ${diff.changed.length} price${diff.changed.length !== 1 ? 's' : ''} updated`);
    const found = diff.changed.length > 0 ? estimateLinesToReprice(readProjects(), diff.changed) : { lines: [], lockedProjects: [] };
    setRepriceSnapshot(found);
    if (found.lines.length + found.lockedProjects.length > 0) setStep('estimates');
    else onClose();
  };

  const updateProject = (projectId: string, lines: EstimateLineChange[]) => {
    const projects = readProjects();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx === -1) return;
    const price = new Map(lines.map(l => [l.lineId, l.to]));
    projects[idx].estimate_items = (projects[idx].estimate_items || []).map((e: any) => price.has(e.id) ? { ...e, unit_price: price.get(e.id) } : e);
    projects[idx].updated_at = new Date().toISOString();
    localStorage.setItem(getUserStorageKey('local_projects'), JSON.stringify(projects));
    syncProjectToSupabase(projects[idx]);
    window.dispatchEvent(new CustomEvent('estimate-updated', { detail: { projectId, source: 'price-list' } }));
    setDoneProjects(s => new Set([...s, projectId]));
    toast.success(`${lines.length} line${lines.length !== 1 ? 's' : ''} repriced in ${lines[0]?.projectName}`);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 'map' ? 'Import supplier price list' : 'Estimates using these materials'}</DialogTitle>
        </DialogHeader>

        {step === 'map' && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Supplier</span>
                <Input value={supplier} onChange={e => setSupplier(e.target.value)} className="h-8 w-56" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Trade for new items</span>
                <Input value={trade} onChange={e => setTrade(e.target.value)} className="h-8 w-40" />
              </label>
              {FIELDS.map(f => (
                <label key={f.key} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{f.label}{f.required ? '' : ' (optional)'}</span>
                  <select className="h-8 w-56 rounded-md border border-border bg-background px-2 text-sm"
                    value={map[f.key] ?? ''}
                    onChange={e => setMap(m => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}>
                    <option value="">Not in this file</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
              <label className="col-span-2 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={incGst} onChange={e => setIncGst(e.target.checked)} />
                <span>Prices in this file include GST (they are stored ex GST, like the rest of Metricore)</span>
              </label>
            </div>

            <div className="rounded-lg border border-border">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Description</span><span>Code</span><span>Unit</span><span className="text-right">Price ex GST</span>
              </div>
              {items.slice(0, 6).map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-1 text-sm">
                  <span className="truncate">{it.name}</span><span className="text-muted-foreground">{it.productCode}</span><span>{it.unit}</span><span className="text-right font-mono">{money(it.unitCost)}</span>
                </div>
              ))}
              {items.length === 0 && <p className="px-3 py-2 text-sm text-amber-400">Choose the description and price columns to read this file.</p>}
            </div>

            {items.length > 0 && (
              <div className="space-y-1 text-sm">
                <p>
                  {items.length} item{items.length !== 1 ? 's' : ''} read: <span className="text-foreground">{diff.added.length} new</span>,{' '}
                  <span className="text-amber-400">{diff.changed.length} price change{diff.changed.length !== 1 ? 's' : ''}</span>, {diff.unchanged} unchanged
                  {skipped > 0 ? `, ${skipped} row${skipped !== 1 ? 's' : ''} without a price skipped` : ''}.
                </p>
                {diff.changed.slice(0, 8).map(c => (
                  <div key={c.existing.id} className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate">{c.existing.name}</span>
                    <span className="font-mono">{money(c.from)} to {money(c.to)} <span className={c.to > c.from ? 'text-red-400' : 'text-green-400'}>{pct(c.from, c.to)}</span></span>
                  </div>
                ))}
                {diff.changed.length > 8 && <p className="text-xs text-muted-foreground">and {diff.changed.length - 8} more</p>}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={apply} disabled={diff.added.length + diff.changed.length === 0}>
                Import {diff.added.length} new and update {diff.changed.length} price{diff.changed.length !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'estimates' && (
          <>
            <p className="text-sm text-muted-foreground">
              These estimate lines still use the old price. Update them job by job; nothing changes until you choose.
            </p>
            <div className="space-y-2">
              {byProject.map(([pid, lines]) => {
                const delta = lines.reduce((s, l) => s + (l.to - l.from) * l.qty, 0);
                const done = doneProjects.has(pid);
                return (
                  <div key={pid} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{lines[0].projectName}</span>
                      <span className="ml-2 text-muted-foreground">{lines.length} line{lines.length !== 1 ? 's' : ''}, materials {delta >= 0 ? '+' : '-'}{money(Math.abs(delta))} before markup</span>
                    </span>
                    <Button size="sm" variant={done ? 'ghost' : 'outline'} disabled={done} onClick={() => updateProject(pid, lines)}>
                      {done ? 'Updated' : 'Update prices'}
                    </Button>
                  </div>
                );
              })}
              {byProject.length === 0 && <p className="text-sm text-muted-foreground">No open estimates use these materials at the old price.</p>}
              {reprice.lockedProjects.length > 0 && (
                <p className="text-xs text-muted-foreground">Left as quoted (quote approved): {reprice.lockedProjects.join(', ')}.</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
