import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { roofGeometry, roofLines, defaultRoof, type RoofInput, type RoofQtyKey } from '@/lib/estimate/roofCalc';
import type { PackLine } from '@/lib/estimate/roomPacks';

const money = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const GEOMETRY: { key: RoofQtyKey; label: string; unit: string }[] = [
  { key: 'roofArea', label: 'Roof area (on the slope)', unit: 'm²' },
  { key: 'ridge', label: 'Ridge', unit: 'm' },
  { key: 'hips', label: 'Hips', unit: 'm' },
  { key: 'barge', label: 'Barges', unit: 'm' },
  { key: 'gutter', label: 'Fascia and gutter', unit: 'm' },
];

/**
 * A roof priced from the building's size: area on the slope from the pitch, ridges, hips,
 * barges and gutters worked out for a gable, hip or skillion roof, then valleys, flashings
 * and extras. Every worked-out length can be overwritten for roofs that aren't a rectangle.
 */
export function RoofCalcDialog({ open, onOpenChange, state, onAdd }: { open: boolean; onOpenChange: (v: boolean) => void; state: string; onAdd: (lines: PackLine[]) => void }) {
  const [input, setInput] = useState<RoofInput>(defaultRoof);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  useEffect(() => { if (open) { setInput(defaultRoof()); setSkip(new Set()); } }, [open]);
  const set = (patch: Partial<RoofInput>) => setInput(prev => ({ ...prev, ...patch }));
  const geo = useMemo(() => roofGeometry(input), [input]);
  const lines = useMemo(() => { try { return roofLines(input, state); } catch { return []; } }, [input, state]);
  useEffect(() => setSkip(new Set()), [lines.length]);
  const chosen = lines.filter((_, i) => !skip.has(i));
  const total = chosen.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const num = (key: keyof RoofInput, label: string, unit?: string) => (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}{unit ? ` (${unit})` : ''}</span>
      <Input inputMode="decimal" value={String(input[key] ?? '')}
        onChange={e => set({ [key]: e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0) } as Partial<RoofInput>)} />
    </label>
  );
  const override = (k: RoofQtyKey, v: string) => {
    const o = { ...(input.overrides ?? {}) };
    if (v.trim() === '') delete o[k]; else o[k] = Math.max(0, parseFloat(v) || 0);
    set({ overrides: o });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Roof calculator</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">From the building's outside size. Typical {state} prices before your markup: check them against your own.</p>

        <div className="grid gap-3 sm:grid-cols-4">
          {num('lengthM', 'Building length', 'm')}
          {num('widthM', 'Building width', 'm')}
          {num('eavesM', 'Eaves overhang', 'm')}
          {num('pitchDeg', 'Pitch', 'degrees')}
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Roof shape</span>
            <select className={selectCls} value={input.shape} onChange={e => set({ shape: e.target.value as RoofInput['shape'], overrides: {} })}>
              <option value="hip">Hip</option><option value="gable">Gable</option><option value="skillion">Skillion</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Roofing</span>
            <select className={selectCls} value={input.material} onChange={e => set({ material: e.target.value as RoofInput['material'] })}>
              <option value="colorbond">Colorbond</option><option value="concrete tile">Concrete tiles</option><option value="terracotta">Terracotta tiles</option>
            </select>
          </label>
          {num('wastePct', 'Waste on sheets or tiles', '%')}
          <div className="flex flex-col justify-end gap-1 pb-1 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={input.removeExisting} onChange={e => set({ removeExisting: e.target.checked })} />Remove existing roof</label>
            {input.material === 'colorbond' && <label className="flex items-center gap-2"><input type="checkbox" checked={input.insulation} onChange={e => set({ insulation: e.target.checked })} />Insulation blanket</label>}
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Worked out: plan area {geo.planArea} m², pitch factor {geo.pitchFactor.toFixed(3)}. Type over any length for an L-shaped or complex roof.
          </p>
          <div className="grid gap-3 sm:grid-cols-5">
            {GEOMETRY.map(g => (
              <label key={g.key} className="block space-y-1">
                <span className="text-xs text-muted-foreground">{g.label} ({g.unit})</span>
                <Input inputMode="decimal" placeholder={String(geo[g.key])} value={input.overrides?.[g.key] == null ? '' : String(input.overrides[g.key])}
                  onChange={e => override(g.key, e.target.value)} />
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-6">
          {num('valleysLm', 'Valleys', 'm')}
          {num('wallFlashingLm', 'Apron and wall flashing', 'm')}
          {num('downpipes', 'Downpipes', 'ea')}
          {num('penetrations', 'Penetrations', 'ea')}
          {num('skylights', 'Skylights', 'ea')}
          {num('vents', 'Roof vents', 'ea')}
        </div>

        <div className="rounded-lg border border-border">
          {lines.map((l, i) => (
            <label key={l.scope} className={cn('grid cursor-pointer grid-cols-[1.5rem_1fr_6rem_6rem_6rem] items-center gap-2 border-b border-border/50 px-3 py-1 text-sm last:border-0', skip.has(i) && 'opacity-40')}>
              <input type="checkbox" checked={!skip.has(i)} onChange={e => setSkip(s => { const n = new Set(s); e.target.checked ? n.delete(i) : n.add(i); return n; })} />
              <span>{l.scope}</span>
              <span className="text-right font-mono text-xs">{l.quantity} {l.unit}</span>
              <span className="text-right font-mono text-xs">{money(l.unitPrice)}</span>
              <span className="text-right font-mono text-xs">{money(l.quantity * l.unitPrice)}</span>
            </label>
          ))}
          {lines.length > 0 && <div className="flex justify-between px-3 py-1.5 text-sm font-medium"><span>{chosen.length} lines, before markup</span><span className="font-mono">{money(total)}</span></div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!chosen.length} onClick={() => onAdd(chosen)}>Add {chosen.length} roofing line{chosen.length !== 1 ? 's' : ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
