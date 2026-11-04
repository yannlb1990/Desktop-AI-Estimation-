import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { packLines, defaultPack, type PackKind, type PackInput, type PackLine } from '@/lib/estimate/roomPacks';

const KINDS: { kind: PackKind; label: string; hint: string }[] = [
  { kind: 'kitchen', label: 'Kitchen', hint: 'Cabinets, benchtop, splashback, appliances, plumbing and power' },
  { kind: 'bathroom', label: 'Bathroom or ensuite', hint: 'Vanity, waterproofing, tiling, screen, toilet, tapware, fan' },
  { kind: 'laundry', label: 'Laundry', hint: 'Cabinets, benchtop, tub, waterproofing, tiling' },
  { kind: 'robes', label: 'Robes and storage', hint: 'Built-in and walk-in robes, linen' },
];

const money = (n: number) => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  state: string;
  /** rooms already in the estimate, offered as names */
  rooms: string[];
  onAdd: (lines: PackLine[]) => void;
}

/**
 * A room described once, added as ordinary estimate lines across the trades it needs.
 * Prices are typical market prices for the state, before your markup: check them against
 * your own subbies, and change any line once it is in the estimate.
 */
export function RoomPackDialog({ open, onOpenChange, state, rooms, onAdd }: Props) {
  const [kind, setKind] = useState<PackKind>('kitchen');
  const [input, setInput] = useState<PackInput>(() => defaultPack('kitchen'));
  const [skip, setSkip] = useState<Set<number>>(new Set());

  useEffect(() => { if (open) { setKind('kitchen'); setInput(defaultPack('kitchen')); setSkip(new Set()); } }, [open]);
  const pick = (k: PackKind) => { setKind(k); setInput(defaultPack(k)); setSkip(new Set()); };

  const lines = useMemo(() => { try { return packLines(input, state); } catch { return []; } }, [input, state]);
  useEffect(() => setSkip(new Set()), [lines.length]);
  const chosen = lines.filter((_, i) => !skip.has(i));
  const total = chosen.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const set = (patch: Record<string, unknown>) => setInput(prev => ({ ...prev, ...patch }) as PackInput);
  const num = (key: string, label: string, unit?: string) => (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}{unit ? ` (${unit})` : ''}</span>
      <Input inputMode="decimal" value={String((input as any)[key] ?? '')}
        onChange={e => set({ [key]: e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0) })} />
    </label>
  );
  const choice = (key: string, label: string, options: string[]) => (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select className={selectCls} value={String((input as any)[key])} onChange={e => set({ [key]: e.target.value })}>
        {options.map(o => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
      </select>
    </label>
  );
  const tick = (key: string, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!(input as any)[key]} onChange={e => set({ [key]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Room packs</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {KINDS.map(k => (
            <button key={k.kind} type="button" onClick={() => pick(k.kind)} title={k.hint}
              className={cn('rounded-md border px-3 py-1.5 text-sm', kind === k.kind ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted/50')}>
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{KINDS.find(k => k.kind === kind)!.hint}. Typical {state} prices before your markup: check them against your subbies' prices.</p>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Room (lines go in this area)</span>
            <Input list="pack-rooms" value={input.room} onChange={e => set({ room: e.target.value })} />
            <datalist id="pack-rooms">{rooms.map(r => <option key={r} value={r} />)}</datalist>
          </label>
          {input.kind !== 'bathroom' && choice('finish', 'Cabinet finish', ['budget', 'standard', 'premium'])}

          {input.kind === 'kitchen' && <>
            {num('baseLm', 'Base cabinets', 'm')}
            {num('overheadLm', 'Overhead cabinets', 'm')}
            {num('islandLm', 'Island', 'm')}
            {num('talls', 'Pantry or oven towers', 'ea')}
            {choice('benchtop', 'Benchtop', ['natural stone', 'porcelain', 'laminate', 'timber'])}
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Benchtop length (m)</span>
              <Input inputMode="decimal" placeholder={String(Math.round((input.baseLm + input.islandLm) * 100) / 100)}
                value={input.benchtopLm == null ? '' : String(input.benchtopLm)}
                onChange={e => set({ benchtopLm: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })} />
            </label>
            {(input.benchtop === 'natural stone' || input.benchtop === 'porcelain') && num('waterfalls', 'Waterfall ends', 'ea')}
            {choice('splashback', 'Splashback', ['tiles', 'glass or stone', 'none'])}
            {num('appliancesAllowance', 'Appliances allowance (PC)', '$')}
            {num('powerPoints', 'Power points', 'ea')}
            {num('downlights', 'Downlights', 'ea')}
            <div className="flex items-end pb-2">{tick('removeExisting', 'Remove existing kitchen')}</div>
          </>}

          {input.kind === 'bathroom' && <>
            {num('floorM2', 'Floor', 'm²')}
            {num('wallTileM2', 'Wall tiles', 'm²')}
            {choice('vanity', 'Vanity', ['none', '600', '900', '1200', 'double 1500'])}
            {choice('screen', 'Shower screen', ['frameless', 'semi-frameless', 'none'])}
            {num('tapwareAllowance', 'Tapware allowance (PC)', '$')}
            <div className="space-y-1.5 sm:col-span-3">
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {tick('vanityTop', 'Stone or porcelain vanity top')}
                {tick('toilet', 'Toilet')}
                {tick('bath', 'Bath')}
                {tick('niche', 'Shower niche')}
                {tick('shavingCabinet', 'Shaving cabinet instead of mirror')}
                {tick('removeExisting', 'Remove existing bathroom')}
              </div>
            </div>
          </>}

          {input.kind === 'laundry' && <>
            {num('baseLm', 'Base cabinets', 'm')}
            {num('overheadLm', 'Overhead cabinets', 'm')}
            {num('talls', 'Tall cupboards', 'ea')}
            {num('benchtopLm', 'Benchtop', 'm')}
            {num('floorM2', 'Floor', 'm²')}
            {num('splashM2', 'Wall tiles', 'm²')}
          </>}

          {input.kind === 'robes' && <>
            {num('builtInLm', 'Built-in robe', 'm')}
            {num('walkInLm', 'Walk-in robe fit-out', 'm')}
            {num('linen', 'Linen cupboards', 'ea')}
          </>}
        </div>

        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-[1.5rem_8rem_1fr_6rem_6rem_6rem] gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
            <span /><span>Trade</span><span>Scope</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Total</span>
          </div>
          {lines.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Enter sizes above to see the lines.</p>}
          {lines.map((l, i) => (
            <label key={`${l.trade}-${l.scope}`} className={cn('grid cursor-pointer grid-cols-[1.5rem_8rem_1fr_6rem_6rem_6rem] items-center gap-2 px-3 py-1 text-sm', skip.has(i) && 'opacity-40')}>
              <input type="checkbox" checked={!skip.has(i)} onChange={e => setSkip(s => { const n = new Set(s); e.target.checked ? n.delete(i) : n.add(i); return n; })} />
              <span className="truncate text-xs text-muted-foreground">{l.trade}</span>
              <span className="truncate">{l.scope}{l.allowance && <span className="ml-1.5 rounded border border-amber-500/50 px-1 text-[10px] text-amber-400">{l.allowance}</span>}</span>
              <span className="text-right font-mono text-xs">{l.quantity} {l.unit}</span>
              <span className="text-right font-mono text-xs">{money(l.unitPrice)}</span>
              <span className="text-right font-mono text-xs">{money(l.quantity * l.unitPrice)}</span>
            </label>
          ))}
          {lines.length > 0 && (
            <div className="flex justify-between border-t border-border px-3 py-1.5 text-sm font-medium">
              <span>{chosen.length} lines, before markup</span><span className="font-mono">{money(total)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={chosen.length === 0} onClick={() => onAdd(chosen)}>
            Add {chosen.length} line{chosen.length !== 1 ? 's' : ''} to {input.room.trim() || 'the estimate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
