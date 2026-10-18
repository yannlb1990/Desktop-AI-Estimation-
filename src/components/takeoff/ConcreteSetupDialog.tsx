import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Measurement } from '@/lib/takeoff/types';
import { getUserStorageKey } from '@/lib/localAuth';
import { rateById } from '@/lib/takeoff/rateAutoFill';
import type { AustralianState } from '@/data/scopeOfWorkRates';
import { cn } from '@/lib/utils';
import { isMeasurementValueLabel } from '@/lib/takeoff/scopeLabels';
import {
  slabLines, footingLines, trenchLines, perimeterOf,
  type ConcreteJob, type ConcreteLine, type SlabSpec, type FootingSpec, type TrenchSpec, type SoilType,
} from '@/lib/takeoff/concreteItems';

export interface PricedConcreteLine extends ConcreteLine { unitPrice: number }

export interface ConcreteSetup {
  job: ConcreteJob;
  slab?: SlabSpec;
  footing?: FootingSpec;
  trench?: TrenchSpec;
  perimeterM?: number;
}

interface Props {
  open: boolean;
  measurement: Measurement | null;
  projectState: AustralianState;
  onConfirm: (m: Measurement, setup: ConcreteSetup, lines: PricedConcreteLine[]) => void;
  onCancel: () => void;
}

const PRICES_KEY = () => getUserStorageKey('concrete_prices');
const readPrices = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(PRICES_KEY()) || '{}'); } catch { return {}; }
};

const DEFAULT_SLAB: SlabSpec = { thicknessMm: 100, edgeBeamWidthMm: 300, edgeBeamDepthMm: 400, meshSheetM2: 0, pump: true };
const DEFAULT_FOOTING: FootingSpec = { widthMm: 450, depthMm: 600, barsPerRun: 1 };
const DEFAULT_TRENCH: TrenchSpec = { widthMm: 450, depthMm: 600, beddingMm: 100, soil: 'clay', truckM3: 10 };

const UNIT_TEXT: Record<string, string> = { M3: 'm³', M2: 'm²', LM: 'lm', EA: 'ea', ITEM: 'item' };
const n = (v: string, fb: number) => { const x = parseFloat(v); return Number.isFinite(x) && x >= 0 ? x : fb; };

export const ConcreteSetupDialog: React.FC<Props> = ({ open, measurement: m, projectState, onConfirm, onCancel }) => {
  const isArea = String(m?.unit || '').toUpperCase().replace('²', '2') === 'M2';
  const [job, setJob] = useState<ConcreteJob>('slab');
  const [slab, setSlab] = useState<SlabSpec>(DEFAULT_SLAB);
  const [footing, setFooting] = useState<FootingSpec>(DEFAULT_FOOTING);
  const [trench, setTrench] = useState<TrenchSpec>(DEFAULT_TRENCH);
  const [perimeter, setPerimeter] = useState('0');
  const [prices, setPrices] = useState<Record<string, string>>({});

  // Open with what this measurement was set up with last time
  useEffect(() => {
    if (!open || !m) return;
    const saved = (m as any).concreteSetup as ConcreteSetup | undefined;
    setJob(saved?.job ?? (isArea ? 'slab' : 'footing'));
    setSlab(saved?.slab ?? { ...DEFAULT_SLAB, thicknessMm: m.concreteDepth ? Math.round(m.concreteDepth * 1000) : DEFAULT_SLAB.thicknessMm });
    setFooting(saved?.footing ?? DEFAULT_FOOTING);
    setTrench(saved?.trench ?? DEFAULT_TRENCH);
    setPerimeter(String(saved?.perimeterM ?? perimeterOf(m as any)));
    const remembered = readPrices();
    setPrices(Object.fromEntries(Object.entries(remembered).map(([k, v]) => [k, String(v)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, m?.id]);

  const qtyBase = m?.realValue ?? 0;
  const lines = useMemo((): ConcreteLine[] => {
    if (!m) return [];
    if (job === 'slab') return slabLines(qtyBase, n(perimeter, 0), slab);
    if (job === 'footing') return footingLines(qtyBase, footing);
    return trenchLines(qtyBase, trench);
  }, [m, job, slab, footing, trench, perimeter, qtyBase]);

  // Starting price: your last price for that component, else the app's rate where one exists
  const defaultPrice = (l: ConcreteLine): number => {
    if (!l.rateId) return 0;
    const r = rateById(l.rateId, projectState);
    // The slab rate is per m² of a 100 mm pour, so per m³ it is ten times that
    return l.rateId === 'conc-001' ? Math.round((r / 0.1) * 100) / 100 : r;
  };
  const priceOf = (l: ConcreteLine): number => {
    // A cleared box means no price (what you see is what is charged)
    const typed = prices[l.priceKey];
    return typed !== undefined ? n(typed, 0) : defaultPrice(l);
  };
  const total = lines.reduce((s, l) => s + l.qty * priceOf(l), 0);
  const unpriced = lines.filter(l => priceOf(l) <= 0).length;

  if (!m) return null;

  const numInput = (value: number, onChange: (v: number) => void, w = 'w-20') => (
    <Input type="number" min="0" value={value} onChange={e => onChange(n(e.target.value, 0))} className={cn('h-8 text-center', w)} />
  );

  const confirm = () => {
    const priced = lines.map(l => ({ ...l, unitPrice: priceOf(l) }));
    try {
      const remembered = readPrices();
      for (const l of priced) if (prices[l.priceKey] !== undefined) remembered[l.priceKey] = l.unitPrice;
      localStorage.setItem(PRICES_KEY(), JSON.stringify(remembered));
    } catch { /* prices just won't be remembered */ }
    onConfirm(m, { job, slab: job === 'slab' ? slab : undefined, footing: job === 'footing' ? footing : undefined, trench: job === 'trench' ? trench : undefined, perimeterM: job === 'slab' ? n(perimeter, 0) : undefined }, priced);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto z-[10002]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            {isArea ? 'Slab setup' : 'Footing or trench'}
            <span className="text-sm font-normal text-muted-foreground">
              {m.label && !isMeasurementValueLabel(m.label) ? m.label : (m.measurementType && m.measurementType !== 'Other' ? m.measurementType : 'Measurement')} · {qtyBase.toFixed(2)} {isArea ? 'm²' : 'lm'}
            </span>
          </DialogTitle>
        </DialogHeader>

        {!isArea && (
          <div className="flex gap-2">
            {(['footing', 'trench'] as const).map(j => (
              <button key={j} onClick={() => setJob(j)}
                className={cn('h-8 px-3 rounded-md border text-sm', job === j ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40')}>
                {j === 'footing' ? 'Strip footing' : 'Service or drainage trench'}
              </button>
            ))}
          </div>
        )}

        {job === 'slab' && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Slab thickness (mm)</span>{numInput(slab.thicknessMm, v => setSlab({ ...slab, thicknessMm: v }))}</label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Perimeter (m)</span>
              <Input type="number" min="0" value={perimeter} onChange={e => setPerimeter(e.target.value)} className="h-8 w-24 text-center" />
            </label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Edge beam width (mm)</span>{numInput(slab.edgeBeamWidthMm, v => setSlab({ ...slab, edgeBeamWidthMm: v }))}</label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Edge beam depth (mm)</span>{numInput(slab.edgeBeamDepthMm, v => setSlab({ ...slab, edgeBeamDepthMm: v }))}</label>
            <label className="flex items-center gap-2 col-span-2 cursor-pointer">
              <input type="checkbox" checked={slab.pump} onChange={e => setSlab({ ...slab, pump: e.target.checked })} />
              <span>Concrete pump</span>
              <span className="text-xs text-muted-foreground">Set edge beam width to 0 for a path or slab without beams. Perimeter comes from the drawing; change it if part of the edge sits on a footing.</span>
            </label>
            {n(perimeter, 0) <= 0 && (
              <p className="col-span-2 text-xs text-amber-400">No perimeter from the drawing: enter it, or edge forms and edge beams are left out.</p>
            )}
          </div>
        )}

        {job === 'footing' && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Width (mm)</span>{numInput(footing.widthMm, v => setFooting({ ...footing, widthMm: v }))}</label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Depth (mm)</span>{numInput(footing.depthMm, v => setFooting({ ...footing, depthMm: v }))}</label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Runs of trench mesh</span>{numInput(footing.barsPerRun, v => setFooting({ ...footing, barsPerRun: Math.round(v) }))}</label>
          </div>
        )}

        {job === 'trench' && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Width (mm)</span>{numInput(trench.widthMm, v => setTrench({ ...trench, widthMm: v }))}</label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Depth (mm)</span>{numInput(trench.depthMm, v => setTrench({ ...trench, depthMm: v }))}</label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Sand bedding (mm)</span>{numInput(trench.beddingMm, v => setTrench({ ...trench, beddingMm: v }))}</label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Truck size (m³)</span>{numInput(trench.truckM3, v => setTrench({ ...trench, truckM3: v }))}</label>
            <label className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Ground</span>
              <select className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={trench.soil} onChange={e => setTrench({ ...trench, soil: e.target.value as SoilType })}>
                <option value="sand">Sand (swells 10%)</option>
                <option value="clay">Clay (swells 25%)</option>
                <option value="rock">Rock (swells 50%)</option>
              </select>
            </label>
          </div>
        )}

        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest mb-2">Lines that will be added to the estimate</div>
          <div className="space-y-1.5">
            {lines.map(l => (
              <div key={l.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm">
                <span>
                  <span>{l.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{l.note}</span>
                </span>
                <span className="font-mono text-right">{l.qty} {UNIT_TEXT[l.unit]}</span>
                <span className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input type="number" min="0" step="0.01" aria-label={`${l.name} price`}
                    value={prices[l.priceKey] !== undefined ? prices[l.priceKey] : (defaultPrice(l) || '')}
                    placeholder="price"
                    onChange={e => setPrices(p => ({ ...p, [l.priceKey]: e.target.value }))}
                    className="h-7 w-24 text-right text-xs" />
                  <span className="text-[11px] text-muted-foreground w-10">/{UNIT_TEXT[l.unit]}</span>
                </span>
                <span className="font-mono text-right w-24">${(l.qty * priceOf(l)).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-amber-400/10 pt-1.5 flex justify-between text-sm">
            <span className="text-muted-foreground">
              {unpriced > 0 ? `${unpriced} without a price yet: enter your supplier's price. ` : ''}Prices you enter are remembered for next time.
            </span>
            <span className="font-mono font-semibold text-amber-400">${total.toFixed(2)}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Rule-of-thumb quantities. Beam sizes, reinforcement and footing depths come from the engineer's drawings.</p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={confirm} disabled={lines.length === 0}>Add to estimate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
