import { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { TRADES } from '@/lib/trades';
import { parseBoq, reconcile, type BoqRow } from '@/lib/estimate/boqImport';
import { readBoqFile, type BoqSheet } from '@/lib/estimate/boqReaders';
import { findScope, scopeRate } from '@/data/tradeScopes';

export type BoqPricing = 'boq' | 'library' | 'none';

export interface BoqLineOut {
  area: string; trade: string; scope: string; unit: string; quantity: number;
  unitPrice: number; allowance?: 'PC' | 'PS'; note: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  state: string;
  defaultMarkup: number;
  onAdd: (lines: BoqLineOut[], markupPct: number) => void;
}

const money = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Row = BoqRow & { keep: boolean; aiSorted?: boolean };

/**
 * A bill of quantities brought into the estimate. Everything is shown before it goes in:
 * the BOQ's own words next to the trade, scope, quantity and rate read from them, rows to
 * look at, and the imported total against the BOQ's own total.
 */
export function BoqImportDialog({ open, onOpenChange, state, defaultMarkup, onAdd }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<BoqSheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [boqTotal, setBoqTotal] = useState<number | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [reading, setReading] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [pricing, setPricing] = useState<BoqPricing>('boq');
  const [markup, setMarkup] = useState(String(defaultMarkup));
  const [area, setArea] = useState('');

  const reset = () => { setFileName(''); setSheets([]); setRows([]); setBoqTotal(null); setSkippedCount(0); setOnlyIssues(false); setArea(''); };
  const load = (s: BoqSheet[], idx: number) => {
    const p = parseBoq(s[idx]?.rows ?? []);
    setRows(p.rows.map(r => ({ ...r, keep: true })));
    setBoqTotal(p.boqTotal);
    setSkippedCount(p.skipped.length);
    const priced = p.rows.some(r => r.rate > 0);
    setPricing(priced ? 'boq' : 'library');
    if (!p.rows.length) toast.error('No priced or measured rows found in this sheet');
  };

  const pickFile = async (file: File) => {
    setReading(true);
    try {
      const s = await readBoqFile(file);
      setFileName(file.name); setSheets(s); setSheetIdx(0); load(s, 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'This file could not be read');
    } finally { setReading(false); }
  };

  const patch = (line: number, p: Partial<Row>) => setRows(rs => rs.map(r => r.line === line
    ? { ...r, ...p, issues: p.trade ? r.issues.filter(i => i !== 'No trade found') : r.issues } : r));

  const kept = rows.filter(r => r.keep);
  const rec = reconcile(kept, boqTotal);
  const allRec = reconcile(rows, boqTotal);
  const noTrade = rows.filter(r => r.keep && !r.trade);
  const withIssues = rows.filter(r => r.issues.length || !r.trade);
  const shown = onlyIssues ? withIssues : rows;

  const priceFor = (r: Row): number => {
    if (r.allowance) return r.rate; // an allowance is the BOQ's amount
    if (pricing === 'boq') return r.rate;
    if (pricing === 'library') { const lib = findScope(r.trade, r.scope); return lib && lib.unit === r.unit ? scopeRate(lib, state) : r.rate; }
    return 0;
  };
  const estimateTotal = useMemo(() => kept.reduce((s, r) => s + r.quantity * priceFor(r), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kept, pricing, state]);

  const sortWithAi = async () => {
    const todo = rows.filter(r => r.keep && !r.trade).slice(0, 300);
    if (!todo.length) return;
    setSorting(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-boq', {
        body: { rows: todo.map(r => ({ i: r.line, text: r.text, heading: r.area })) },
      });
      if (error) {
        let msg = error.message;
        try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* keep message */ }
        throw new Error(msg);
      }
      const answers: { i: number; trade: string; scope: string }[] = (data as any)?.rows ?? [];
      setRows(rs => rs.map(r => {
        const a = answers.find(x => x.i === r.line);
        return a ? { ...r, trade: a.trade, scope: a.scope || r.scope, aiSorted: true, issues: r.issues.filter(i => i !== 'No trade found') } : r;
      }));
      toast.success(`${answers.length} row${answers.length !== 1 ? 's' : ''} sorted: check them before adding`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The rows could not be sorted');
    } finally { setSorting(false); }
  };

  const add = () => {
    if (noTrade.length) { toast.error(`${noTrade.length} row${noTrade.length !== 1 ? 's have' : ' has'} no trade: pick one, sort them with AI, or untick them`); return; }
    const m = parseFloat(markup);
    onAdd(kept.map(r => ({
      area: r.area || area.trim(),
      trade: r.trade,
      scope: r.scope,
      unit: r.unit || 'item',
      quantity: r.quantity,
      unitPrice: Math.round(priceFor(r) * 10000) / 10000,
      ...(r.allowance ? { allowance: r.allowance } : {}),
      note: `BOQ${r.itemNo ? ` item ${r.itemNo}` : ''}, row ${r.line}${fileName ? ` of ${fileName}` : ''}`,
    })), isNaN(m) ? defaultMarkup : m);
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-6xl max-h-[94vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import a bill of quantities</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.pdf,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ''; }} />
          <Button variant="outline" size="sm" disabled={reading} onClick={() => fileRef.current?.click()}>
            {reading ? 'Reading...' : fileName ? 'Choose another file' : 'Choose the BOQ file'}
          </Button>
          <span className="text-muted-foreground">{fileName || 'Excel (.xlsx), CSV, or a PDF with selectable text'}</span>
          {sheets.length > 1 && (
            <select className="h-8 rounded-md border border-input bg-background px-2" value={sheetIdx}
              onChange={e => { const i = Number(e.target.value); setSheetIdx(i); load(sheets, i); }}>
              {sheets.map((s, i) => <option key={s.name} value={i}>Sheet: {s.name} ({s.rows.length} rows)</option>)}
            </select>
          )}
        </div>

        {rows.length > 0 && (
          <>
            {/* The check that the import is complete: the BOQ's own total against what is ticked */}
            <div className={cn('grid gap-x-6 gap-y-1 rounded-lg border px-4 py-2 text-sm sm:grid-cols-4',
              rec.difference === null ? 'border-border' : Math.abs(rec.difference) < 0.01 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/50 bg-amber-500/5')}>
              <span><span className="block text-xs text-muted-foreground">Rows read</span>{rows.length} priced or measured, {skippedCount} headings and subtotals left out</span>
              <span><span className="block text-xs text-muted-foreground">Ticked rows total (BOQ amounts)</span><span className="font-mono">{money(rec.imported)}</span></span>
              <span><span className="block text-xs text-muted-foreground">BOQ's own total</span><span className="font-mono">{boqTotal == null ? 'not found in the file' : money(boqTotal)}</span></span>
              <span>
                <span className="block text-xs text-muted-foreground">Check</span>
                {rec.difference === null ? <span className="text-muted-foreground">Compare with the BOQ total yourself</span>
                  : Math.abs(rec.difference) < 0.01 ? <span className="text-emerald-400">Matches to the cent</span>
                  : <span className="text-amber-400">
                      {rec.difference > 0 ? '+' : ''}{money(rec.difference)} off
                      {allRec.difference !== null && Math.abs(allRec.difference) < 0.01 ? ': some rows are unticked' : ': look for rows split oddly in the file'}
                    </span>}
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-4 text-sm">
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">Prices on the estimate lines</span>
                <select className="h-9 rounded-md border border-input bg-background px-2" value={pricing} onChange={e => setPricing(e.target.value as BoqPricing)}>
                  <option value="boq">The BOQ's rates</option>
                  <option value="library">Typical {state} rates where the scope is in the library, else the BOQ's</option>
                  <option value="none">No price: I will price or ask subbies</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">Markup on these lines %</span>
                <Input className="h-9 w-24 font-mono" inputMode="decimal" value={markup} onChange={e => setMarkup(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted-foreground">Room for rows without one</span>
                <Input className="h-9 w-44" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Whole house" />
              </label>
              <span className="pb-2 text-muted-foreground">Estimate lines total before markup: <span className="font-mono text-foreground">{money(estimateTotal)}</span></span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
                Only rows to look at ({withIssues.length})
              </label>
              {noTrade.length > 0 && (
                <Button size="sm" variant="outline" disabled={sorting} onClick={sortWithAi}>
                  {sorting ? 'Sorting...' : `Sort ${noTrade.length} row${noTrade.length !== 1 ? 's' : ''} without a trade with AI`}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">PC and PS sums come in as allowances at the BOQ amount, with no markup.</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-1.5" />
                    <th className="px-2 py-1.5 text-left">In the BOQ</th>
                    <th className="px-2 py-1.5 text-left">Trade</th>
                    <th className="px-2 py-1.5 text-left">Scope of work</th>
                    <th className="px-2 py-1.5 text-left">Room</th>
                    <th className="px-2 py-1.5 text-right">Qty</th>
                    <th className="px-2 py-1.5 text-left">Unit</th>
                    <th className="px-2 py-1.5 text-right">Rate</th>
                    <th className="px-2 py-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(r => (
                    <tr key={r.line} className={cn('border-t border-border/50 align-top', !r.keep && 'opacity-40', (r.issues.length || !r.trade) && r.keep && 'bg-amber-500/5')}>
                      <td className="px-2 py-1.5"><input type="checkbox" checked={r.keep} onChange={e => patch(r.line, { keep: e.target.checked })} /></td>
                      <td className="max-w-[260px] px-2 py-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{r.itemNo || `row ${r.line}`}</span> {r.text}
                        {r.issues.map(i => <span key={i} className="block text-amber-400">{i}</span>)}
                      </td>
                      <td className="px-2 py-1.5">
                        <select className={cn('h-8 w-40 rounded-md border bg-background px-1 text-xs', r.trade ? 'border-input' : 'border-amber-500')}
                          value={r.trade} onChange={e => patch(r.line, { trade: e.target.value })}>
                          <option value="">Choose a trade</option>
                          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {r.aiSorted && <span className="block text-[10px] text-muted-foreground">sorted by AI</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <textarea rows={2} className="w-72 resize-y rounded-md border border-input bg-background px-1.5 py-1 text-xs"
                          value={r.scope} onChange={e => patch(r.line, { scope: e.target.value })} />
                        {r.allowance && <span className="mt-0.5 inline-block rounded border border-amber-500/50 px-1 text-[10px] text-amber-400">{r.allowance} allowance</span>}
                      </td>
                      <td className="px-2 py-1.5"><input className="h-8 w-28 rounded-md border border-input bg-background px-1.5 text-xs" value={r.area} placeholder={area || 'none'} onChange={e => patch(r.line, { area: e.target.value })} /></td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">{r.quantity}</td>
                      <td className="px-2 py-1.5 text-xs">{r.unit}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">{r.rate ? money(r.rate) : ''}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs">{r.amount ? money(r.amount) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!kept.length} onClick={add}>Add {kept.length} line{kept.length !== 1 ? 's' : ''} to the estimate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
