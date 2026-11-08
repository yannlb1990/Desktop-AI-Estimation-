import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getUserStorageKey } from '@/lib/localAuth';
import {
  cabinetParts, cabinetLines, defaultCabinets, DEFAULT_CABINET_PRICES,
  type CabinetInput, type CabinetPrices, type CabinetRun, type FrontFinish,
} from '@/lib/estimate/cabinetCalc';
import type { PackLine } from '@/lib/estimate/roomPacks';

const money = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const PRICE_KEY = () => getUserStorageKey('cabinet_prices');
const readPrices = (): CabinetPrices => {
  try { const v = JSON.parse(localStorage.getItem(PRICE_KEY()) || 'null'); return v ? { ...DEFAULT_CABINET_PRICES, ...v, front: { ...DEFAULT_CABINET_PRICES.front, ...(v.front ?? {}) } } : DEFAULT_CABINET_PRICES; }
  catch { return DEFAULT_CABINET_PRICES; }
};
const FINISHES: FrontFinish[] = ['melamine', 'laminate', 'thermofoil', 'two-pac', 'veneer'];

/**
 * A kitchen, vanity, laundry or robe built from its runs: carcasses, fronts, drawers and
 * hardware with the sheets to order, each priced as material plus hours. The builder's
 * own prices and hours are kept for next time.
 */
export function CabinetBuilderDialog({ open, onOpenChange, state, labourRate, rooms, onAdd }: {
  open: boolean; onOpenChange: (v: boolean) => void; state: string; labourRate: number; rooms: string[];
  onAdd: (lines: (PackLine & { labourHours: number })[]) => void;
}) {
  const [input, setInput] = useState<CabinetInput>(defaultCabinets);
  const [prices, setPrices] = useState<CabinetPrices>(readPrices);
  const [showPrices, setShowPrices] = useState(false);
  useEffect(() => { if (open) { setInput(defaultCabinets()); setPrices(readPrices()); } }, [open]);
  const set = (patch: Partial<CabinetInput>) => setInput(prev => ({ ...prev, ...patch }));
  const setRun = (id: string, patch: Partial<CabinetRun>) => set({ runs: input.runs.map(r => r.id === id ? { ...r, ...patch } : r) });
  const savePrices = (next: CabinetPrices) => { setPrices(next); try { localStorage.setItem(PRICE_KEY(), JSON.stringify(next)); } catch { /* this session only */ } };

  const parts = useMemo(() => cabinetParts(input), [input]);
  const lines = useMemo(() => cabinetLines(input, prices, state), [input, prices, state]);
  const cost = (l: { quantity: number; unitPrice: number; labourHours: number }) => l.quantity * l.unitPrice + l.labourHours * labourRate;
  const total = lines.reduce((s, l) => s + cost(l), 0);
  const hours = lines.reduce((s, l) => s + l.labourHours, 0);
  const n = (v: number) => (v === 0 ? '' : String(v));
  const pnum = (v: string) => Math.max(0, parseFloat(v) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cabinet builder</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Each run is split into 600 mm carcasses. Material at your prices, labour at {money(labourRate)}/h (your joinery rate). Set your prices once under Your prices.</p>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Room</span>
            <Input list="cab-rooms" value={input.room} onChange={e => set({ room: e.target.value })} />
            <datalist id="cab-rooms">{['Kitchen', 'Laundry', 'Bathroom', 'Ensuite', ...rooms].map(r => <option key={r} value={r} />)}</datalist>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Door and drawer fronts</span>
            <select className={selectCls} value={input.finish} onChange={e => set({ finish: e.target.value as FrontFinish })}>
              {FINISHES.map(f => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={input.install} onChange={e => set({ install: e.target.checked })} />Include installation</label>
        </div>

        <div className="space-y-2">
          {input.runs.map((r, idx) => (
            <div key={r.id} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Run {idx + 1}</span>
                <select className={selectCls} value={r.kind} onChange={e => setRun(r.id, { kind: e.target.value as CabinetRun['kind'] })}>
                  <option value="base">Base cabinets</option><option value="overhead">Overhead cabinets</option><option value="tall">Tall (pantry, oven tower)</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Length (m)</span>
                <Input inputMode="decimal" value={n(r.lengthM)} onChange={e => setRun(r.id, { lengthM: pnum(e.target.value) })} />
              </label>
              {r.kind === 'base' ? (
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Drawer banks (3 drawers each)</span>
                  <Input inputMode="numeric" value={n(r.drawerBanks)} onChange={e => setRun(r.id, { drawerBanks: Math.round(pnum(e.target.value)) })} />
                </label>
              ) : <span />}
              <Button size="sm" variant="ghost" onClick={() => set({ runs: input.runs.filter(x => x.id !== r.id) })}>Remove</Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => set({ runs: [...input.runs, { id: crypto.randomUUID(), kind: 'base', lengthM: 0, drawerBanks: 0 }] })}>Add a run</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Benchtop</span>
            <select className={selectCls} value={input.benchtop} onChange={e => set({ benchtop: e.target.value as CabinetInput['benchtop'] })}>
              <option value="natural stone">Natural stone</option><option value="porcelain">Porcelain</option><option value="laminate">Laminate</option><option value="timber">Timber</option><option value="none">No benchtop</option>
            </select>
          </label>
          {input.benchtop !== 'none' && <>
            <label className="block space-y-1"><span className="text-xs text-muted-foreground">Benchtop length (m)</span>
              <Input inputMode="decimal" value={n(input.benchtopLm)} onChange={e => set({ benchtopLm: pnum(e.target.value) })} /></label>
            <label className="block space-y-1"><span className="text-xs text-muted-foreground">Cut-outs</span>
              <Input inputMode="numeric" value={n(input.cutOuts)} onChange={e => set({ cutOuts: Math.round(pnum(e.target.value)) })} /></label>
          </>}
          <label className="block space-y-1"><span className="text-xs text-muted-foreground">End panels</span>
            <Input inputMode="numeric" value={n(input.endPanels)} onChange={e => set({ endPanels: Math.round(pnum(e.target.value)) })} /></label>
        </div>

        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          {parts.carcasses} carcasses · {parts.sheets} sheets of 16 mm board to order ({parts.boardM2} m² plus 15% offcuts) · {parts.frontsM2} m² of fronts · {parts.doors} doors · {parts.drawers} drawers · {parts.hinges} hinges · {parts.handles} handles · {parts.kickboardLm} m kickboard
        </p>

        <div>
          <button type="button" className="text-sm font-medium hover:underline" onClick={() => setShowPrices(v => !v)}>{showPrices ? 'Hide your prices' : 'Your prices and hours'}</button>
          {showPrices && (
            <div className="mt-2 grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-4">
              {([['boardSheet', 'Board, per sheet ($)'], ['hinge', 'Hinge ($)'], ['runnerPair', 'Drawer runners, per pair ($)'], ['handle', 'Handle ($)'], ['kickboardLm', 'Kickboard per m ($)'], ['endPanel', 'End panel ($)'],
                ['hoursCarcass', 'Hours to make a carcass'], ['hoursDoor', 'Hours per door'], ['hoursDrawer', 'Hours per drawer'], ['hoursInstall', 'Hours to install a carcass']] as [keyof CabinetPrices, string][]).map(([k, label]) => (
                <label key={k} className="block space-y-1"><span className="text-xs text-muted-foreground">{label}</span>
                  <Input inputMode="decimal" value={String(prices[k] as number)} onChange={e => savePrices({ ...prices, [k]: pnum(e.target.value) })} /></label>
              ))}
              {FINISHES.map(f => (
                <label key={f} className="block space-y-1"><span className="text-xs text-muted-foreground">{f[0].toUpperCase() + f.slice(1)} fronts per m² ($)</span>
                  <Input inputMode="decimal" value={String(prices.front[f])} onChange={e => savePrices({ ...prices, front: { ...prices.front, [f]: pnum(e.target.value) } })} /></label>
              ))}
              <Button size="sm" variant="ghost" className="self-end" onClick={() => savePrices(DEFAULT_CABINET_PRICES)}>Back to the starting prices</Button>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border text-sm">
          <div className="grid grid-cols-[1fr_6rem_6rem_5rem_7rem] gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span>Line</span><span className="text-right">Qty</span><span className="text-right">Material</span><span className="text-right">Hours</span><span className="text-right">Cost</span>
          </div>
          {lines.map(l => (
            <div key={l.scope} className="grid grid-cols-[1fr_6rem_6rem_5rem_7rem] gap-2 border-b border-border/50 px-3 py-1 last:border-0">
              <span>{l.scope}</span>
              <span className="text-right font-mono text-xs">{l.quantity} {l.unit}</span>
              <span className="text-right font-mono text-xs">{money(l.unitPrice)}</span>
              <span className="text-right font-mono text-xs">{l.labourHours || ''}</span>
              <span className="text-right font-mono text-xs">{money(cost(l))}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-1.5 font-medium"><span>{lines.length} lines, {Math.round(hours * 10) / 10} hours, cost before markup</span><span className="font-mono">{money(total)}</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!lines.length} onClick={() => onAdd(lines)}>Add {lines.length} lines to {input.room || 'the estimate'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
