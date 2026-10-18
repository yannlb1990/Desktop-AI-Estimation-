import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getUserStorageKey } from '@/lib/localAuth';
import { cn } from '@/lib/utils';
import {
  ELECTRICAL_POINTS, PLUMBING_FIXTURES, countsFromPlan, suggestElectrical, suggestHotWaterLitres,
  roomLoads, ductedSize, NOT_CONDITIONED, type ServiceLine,
} from '@/lib/estimate/servicesItems';
import { isMeasurementValueLabel } from '@/lib/takeoff/scopeLabels';

export interface PricedServiceLine extends ServiceLine { unitPrice: number }

interface Props {
  open: boolean;
  /** takeoff measurements: count markers for points, room areas for air conditioning */
  measurements: any[];
  onAdd: (lines: PricedServiceLine[]) => void;
  onClose: () => void;
}

type Tab = 'electrical' | 'plumbing' | 'hvac';
const PRICES_KEY = () => getUserStorageKey('services_prices');
const readPrices = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(PRICES_KEY()) || '{}'); } catch { return {}; }
};
const num = (v: string | undefined) => { const x = parseFloat(v ?? ''); return Number.isFinite(x) && x > 0 ? x : 0; };

export const ServicesDialog: React.FC<Props> = ({ open, measurements, onAdd, onClose }) => {
  const [tab, setTab] = useState<Tab>('electrical');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [bedrooms, setBedrooms] = useState('3');
  const [storeys, setStoreys] = useState('1');
  const [people, setPeople] = useState('4');
  const [withBoard, setWithBoard] = useState(true);
  const [withHws, setWithHws] = useState(true);
  const [mode, setMode] = useState<'split' | 'ducted'>('split');
  const [rooms, setRooms] = useState<{ name: string; m2: string }[]>([]);

  const elPlan = useMemo(() => countsFromPlan(ELECTRICAL_POINTS, measurements), [measurements]);
  const plPlan = useMemo(() => countsFromPlan(PLUMBING_FIXTURES, measurements), [measurements]);

  useEffect(() => {
    if (!open) return;
    setPrices(readPrices());
    // Counts named on the plan fill in; everything else starts empty
    const start: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...elPlan, ...plPlan })) start[k] = String(v.qty);
    setQty(start);
    // Rooms: floor measurements (ceilings only where a room has no floor, never both),
    // named by their label ("Bedroom 2") or else their area; wet, garage and outdoor areas left out
    const roomName = (m: any) => (m.label && !isMeasurementValueLabel(m.label) && !/^(floor|ceiling|area|polygon|rectangle)\s*\d*$/i.test(m.label.trim())) ? m.label.trim() : m.area;
    const collect = (type: string) => {
      const out = new Map<string, number>();
      for (const m of measurements) {
        const u = String(m.unit || '').toUpperCase().replace('²', '2');
        if (u !== 'M2' || m.measurementType !== type || !m.area || m.area === 'General') continue;
        const name = roomName(m);
        if (NOT_CONDITIONED.test(name) || NOT_CONDITIONED.test(m.area)) continue;
        out.set(name, (out.get(name) ?? 0) + (Number(m.realValue) || 0));
      }
      return out;
    };
    const byRoom = collect('Floor');
    for (const [name, m2] of collect('Ceiling')) if (!byRoom.has(name)) byRoom.set(name, m2);
    setRooms([...byRoom.entries()].map(([name, m2]) => ({ name, m2: String(Math.round(m2 * 10) / 10) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const q = (k: string) => num(qty[k]);
  const fromPlan = (k: string) => elPlan[k]?.ids ?? plPlan[k]?.ids;

  const lines = useMemo((): ServiceLine[] => {
    if (tab === 'electrical') {
      const out: ServiceLine[] = ELECTRICAL_POINTS.filter(p => q(p.key) > 0).map(p => ({
        key: p.key, label: p.label, trade: 'Electrician', unit: 'EA', qty: q(p.key), priceKey: `el_${p.key}`,
        note: 'Supply and install', measurementIds: fromPlan(p.key),
      }));
      if (withBoard) {
        const s = suggestElectrical(Object.fromEntries(ELECTRICAL_POINTS.map(p => [p.key, q(p.key)])), num(bedrooms), num(storeys) || 1);
        if (s.rcbos > 0) {
          out.push({ key: 'rcbo', label: 'RCBO (one per circuit)', trade: 'Electrician', unit: 'EA', qty: s.rcbos, priceKey: 'el_rcbo',
            note: `${s.lightingCircuits} lighting, ${s.powerCircuits} power, ${s.dedicatedCircuits} dedicated circuits` });
          out.push({ key: 'board', label: 'Switchboard', trade: 'Electrician', unit: 'ITEM', qty: 1, priceKey: 'el_board', note: 'Board, main switch and connection' });
        }
      }
      return out;
    }
    if (tab === 'plumbing') {
      const out: ServiceLine[] = PLUMBING_FIXTURES.filter(p => q(p.key) > 0).map(p => ({
        key: p.key, label: p.label, trade: 'Plumber', unit: 'EA', qty: q(p.key), priceKey: `pl_${p.key}`,
        note: 'Rough-in and fit-off', measurementIds: fromPlan(p.key),
      }));
      if (withHws && num(people) > 0) {
        const l = suggestHotWaterLitres(num(people));
        out.push({ key: 'hws', label: `Hot water system ${l} L`, trade: 'Plumber', unit: 'ITEM', qty: 1, priceKey: `pl_hws_${l}`, note: `Electric storage for ${num(people)} people; gas, heat pump and off-peak tanks size differently` });
      }
      return out;
    }
    const loads = roomLoads(rooms.map(r => ({ name: r.name, m2: num(r.m2) })));
    if (mode === 'split') {
      return loads.map((r, i) => ({
        key: `split_${i}`, label: `Split system ${r.splitKw.toFixed(1)} kW - ${r.name}`, trade: 'HVAC Technician', unit: 'EA', qty: 1,
        priceKey: `ac_split_${r.splitKw}`,
        note: r.tooBig ? `Needs about ${r.kw} kW, more than one split: use two units or ducted` : `${r.m2} m² at ${r.wPerM2} W/m² = ${r.kw} kW, supply and install`,
      }));
    }
    const d = ductedSize(loads);
    if (d.totalKw <= 0) return [];
    return [
      { key: 'ducted', label: `Ducted system ${d.unitKw.toFixed(1)} kW`, trade: 'HVAC Technician', unit: 'ITEM', qty: 1, priceKey: `ac_ducted_${d.unitKw}`,
        note: d.tooBig ? `Rooms add to ${d.totalKw} kW: more than one ducted unit, zone the house` : `Rooms add to ${d.totalKw} kW; about 80% runs at once` },
      { key: 'outlets', label: 'Ducted outlets', trade: 'HVAC Technician', unit: 'EA', qty: d.outlets, priceKey: 'ac_outlet', note: 'One per room, two in rooms over 25 m²' },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qty, withBoard, bedrooms, storeys, withHws, people, rooms, mode, elPlan, plPlan]);

  const priceOf = (l: ServiceLine) => num(prices[l.priceKey]);
  const total = lines.reduce((s, l) => s + l.qty * priceOf(l), 0);
  const suggestion = suggestElectrical(Object.fromEntries(ELECTRICAL_POINTS.map(p => [p.key, q(p.key)])), num(bedrooms), num(storeys) || 1);

  const add = () => {
    try {
      const saved = readPrices();
      for (const l of lines) if (prices[l.priceKey] !== undefined) saved[l.priceKey] = prices[l.priceKey];
      localStorage.setItem(PRICES_KEY(), JSON.stringify(saved));
    } catch { /* prices just won't be remembered */ }
    onAdd(lines.map(l => ({ ...l, unitPrice: priceOf(l) })));
  };

  // Shown most-used first; the matching order (specific names first) is a different thing
  const DISPLAY_ORDER = ['gpo_double', 'gpo_single', 'light', 'switch', 'smoke', 'outdoor', 'fan', 'data', 'tv', 'oven', 'cooktop', 'ac_circuit', 'hws_circuit'];
  const qtyGrid = (types: typeof ELECTRICAL_POINTS, plan: Record<string, { qty: number }>) => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {[...types].sort((a, b) => (DISPLAY_ORDER.indexOf(a.key) + 1 || 99) - (DISPLAY_ORDER.indexOf(b.key) + 1 || 99)).map(p => (
        <label key={p.key} className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{p.label}{plan[p.key] ? <span className="ml-1 text-[10px] text-amber-400">from plan</span> : null}</span>
          <Input type="number" min="0" value={qty[p.key] ?? ''} placeholder="0"
            onChange={e => setQty(v => ({ ...v, [p.key]: e.target.value }))} className="h-7 w-16 text-center" />
        </label>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Services</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {([['electrical', 'Electrical'], ['plumbing', 'Plumbing'], ['hvac', 'Air conditioning']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn('h-8 px-3 rounded-md border text-sm', tab === k ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40')}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'electrical' && (
          <>
            <p className="text-xs text-muted-foreground">Count markers on the plan named like "Double GPO", "Downlight" or "Smoke alarm" fill in by themselves and stay linked.</p>
            {qtyGrid(ELECTRICAL_POINTS, elPlan)}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <label className="flex items-center gap-2"><span className="text-muted-foreground">Bedrooms</span><Input type="number" min="0" value={bedrooms} onChange={e => setBedrooms(e.target.value)} className="h-7 w-14 text-center" /></label>
              <label className="flex items-center gap-2"><span className="text-muted-foreground">Storeys</span><Input type="number" min="1" value={storeys} onChange={e => setStoreys(e.target.value)} className="h-7 w-14 text-center" /></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={withBoard} onChange={e => setWithBoard(e.target.checked)} />Switchboard and RCBOs</label>
            </div>
            {q('smoke') < suggestion.smokeAlarmsMin && (
              <p className="text-xs text-amber-400">
                Smoke alarms: at least {suggestion.smokeAlarmsMin} for {num(bedrooms)} bedrooms on {num(storeys) || 1} storey{(num(storeys) || 1) > 1 ? 's' : ''}. Queensland requires one in every bedroom plus hallways serving them and every storey, interconnected (NCC alone: hallways serving bedrooms and every storey).
              </p>
            )}
          </>
        )}

        {tab === 'plumbing' && (
          <>
            {qtyGrid(PLUMBING_FIXTURES, plPlan)}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={withHws} onChange={e => setWithHws(e.target.checked)} />Hot water system for</label>
              <Input type="number" min="1" value={people} onChange={e => setPeople(e.target.value)} className="h-7 w-14 text-center" />
              <span className="text-muted-foreground">people</span>
            </div>
          </>
        )}

        {tab === 'hvac' && (
          <>
            <div className="flex gap-2">
              {(['split', 'ducted'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={cn('h-7 px-3 rounded-md border text-xs', mode === m ? 'border-primary bg-primary/10' : 'border-border')}>
                  {m === 'split' ? 'Split system per room' : 'Ducted, whole house'}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 text-sm">
              {rooms.length === 0 && <p className="text-xs text-muted-foreground">No room areas on the plan yet. Add rooms below, or measure floors and set their Area (Bedroom, Living...).</p>}
              {rooms.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={r.name} onChange={e => setRooms(rs => rs.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} className="h-7 w-40" />
                  <Input type="number" min="0" value={r.m2} onChange={e => setRooms(rs => rs.map((x, k) => k === i ? { ...x, m2: e.target.value } : x))} className="h-7 w-20 text-center" />
                  <span className="text-xs text-muted-foreground">m²</span>
                  <button className="text-xs text-muted-foreground hover:text-red-400" onClick={() => setRooms(rs => rs.filter((_, k) => k !== i))}>Remove</button>
                </div>
              ))}
              <button className="text-xs text-[#D4A045] hover:underline" onClick={() => setRooms(rs => {
                let n = rs.length + 1;
                while (rs.some(r => r.name === `Room ${n}`)) n++;
                return [...rs, { name: `Room ${n}`, m2: '' }];
              })}>Add a room</button>
            </div>
            <p className="text-[11px] text-muted-foreground">Cooling by floor area: 140 W/m² living and kitchen, 110 bedrooms, 125 other rooms. West sun, high ceilings or poor insulation need more; in cold climates (Melbourne, Canberra, Tasmania) heating usually sets the size. Rooms come from floor measurements; wet areas, garages and outdoor areas are left out. The installer confirms.</p>
          </>
        )}

        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest mb-2">Lines that will be added to the estimate</div>
          {lines.length === 0 && <p className="text-sm text-muted-foreground">Enter some quantities above.</p>}
          <div className="space-y-1.5">
            {lines.map(l => (
              <div key={l.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm">
                <span>{l.label}<span className="block text-[11px] text-muted-foreground">{l.note}</span></span>
                <span className="font-mono text-right">{l.qty} {l.unit === 'ITEM' ? 'item' : 'ea'}</span>
                <span className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input type="number" min="0" step="0.01" aria-label={`${l.label} price`} value={prices[l.priceKey] ?? ''} placeholder="price"
                    onChange={e => setPrices(p => ({ ...p, [l.priceKey]: e.target.value }))} className="h-7 w-24 text-right text-xs" />
                </span>
                <span className="font-mono text-right w-24">${(l.qty * priceOf(l)).toFixed(2)}</span>
              </div>
            ))}
          </div>
          {lines.length > 0 && (
            <div className="mt-2 border-t border-amber-400/10 pt-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Your cost per point, all in; the estimate adds your markup. Prices are remembered for next time.</span>
              <span className="font-mono font-semibold text-amber-400">${total.toFixed(2)}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={add} disabled={lines.length === 0}>
            Add {tab === 'electrical' ? 'electrical' : tab === 'plumbing' ? 'plumbing' : 'air conditioning'} lines
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
