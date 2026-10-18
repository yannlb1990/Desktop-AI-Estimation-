import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Measurement } from '@/lib/takeoff/types';
import { cn } from '@/lib/utils';
import {
  wallLines, wallMembers, openingsArea, legacyWallBuild, FACE_LABELS, INSULATION_LABELS, FRAMING_LABELS,
  type WallBuild, type FaceFinish, type WallLine,
} from '@/lib/takeoff/wallItems';

interface WallPreset {
  id: string;
  label: string;
  description: string;
  build: Pick<WallBuild, 'framingSystem' | 'faceA' | 'faceB' | 'layers' | 'insulationType'>;
}

export const WALL_PRESETS: WallPreset[] = [
  { id: 'standard_internal', label: 'Standard Internal', description: '90mm timber · PB both faces · R2.0 batts',
    build: { framingSystem: 'timber_90_mgp10', faceA: 'pb_10', faceB: 'pb_10', layers: 1, insulationType: 'r2_batts' } },
  { id: 'external', label: 'External Wall', description: '90mm timber · PB inside · FC cladding outside · R2.5 batts',
    build: { framingSystem: 'timber_90_mgp10', faceA: 'pb_10', faceB: 'fc_ext', layers: 1, insulationType: 'r25_batts' } },
  { id: 'wet_area', label: 'Wet Area', description: '90mm timber · FC both faces · no batts',
    build: { framingSystem: 'timber_90_mgp10', faceA: 'fc_6', faceB: 'fc_6', layers: 1, insulationType: null } },
  { id: 'steel_internal', label: 'Steel Stud', description: '92mm steel · PB both faces · R2.0 batts',
    build: { framingSystem: 'steel_92', faceA: 'pb_10', faceB: 'pb_10', layers: 1, insulationType: 'r2_batts' } },
  { id: 'brick_veneer', label: 'Brick Veneer', description: '90mm timber · PB inside · brick outer skin · R2.5 batts',
    build: { framingSystem: 'timber_90_mgp10', faceA: 'pb_10', faceB: 'brick', layers: 1, insulationType: 'r25_batts' } },
  { id: 'weatherboard', label: 'Weatherboard', description: '90mm timber · PB inside · weatherboards outside · R2.5 batts',
    build: { framingSystem: 'timber_90_mgp10', faceA: 'pb_10', faceB: 'weatherboard', layers: 1, insulationType: 'r25_batts' } },
  { id: 'partition_70', label: '70mm Partition', description: '70mm timber · PB both faces · no batts',
    build: { framingSystem: 'timber_70_mgp10', faceA: 'pb_10', faceB: 'pb_10', layers: 1, insulationType: null } },
  { id: 'acoustic', label: 'Acoustic Wall', description: '90mm timber · 13mm PB both faces · acoustic batts',
    build: { framingSystem: 'timber_90_mgp10', faceA: 'pb_13', faceB: 'pb_13', layers: 1, insulationType: 'acoustic' } },
  { id: 'fire_rated', label: 'Fire-Rated Wall', description: '92mm steel · 2 layers FC each face · acoustic batts',
    build: { framingSystem: 'steel_92', faceA: 'fc_9', faceB: 'fc_9', layers: 2, insulationType: 'acoustic' } },
];

export interface WallUpdate {
  id: string;
  configuredMeasurement: Measurement;
}

interface WallSetupDialogProps {
  open: boolean;
  walls: Measurement[];
  onConfirm: (updates: WallUpdate[]) => void;
  onCancel: () => void;
}

const INSIDE_FACES: FaceFinish[] = ['pb_10', 'pb_13', 'fc_6', 'fc_9', 'none'];
const OTHER_FACES: FaceFinish[] = ['pb_10', 'pb_13', 'fc_6', 'fc_9', 'fc_ext', 'weatherboard', 'brick', 'none'];

const num = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const unitText = (u: string) => (u === 'LM' ? 'lm' : 'm²');

const selectCls = 'h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground';

export const WallSetupDialog: React.FC<WallSetupDialogProps> = ({ open, walls, onConfirm, onCancel }) => {
  const [height, setHeight] = useState('2.7');
  const [presetId, setPresetId] = useState(WALL_PRESETS[0].id);
  const [build, setBuild] = useState<WallPreset['build']>(WALL_PRESETS[0].build);
  const [doors, setDoors] = useState('0');
  const [windows, setWindows] = useState('0');
  const [windowW, setWindowW] = useState('1.2');
  const [windowH, setWindowH] = useState('1.2');
  const [paint, setPaint] = useState(false);
  const [skirting, setSkirting] = useState(false);
  const [cornice, setCornice] = useState(false);

  // Open with what the wall already has (height, faces, openings), or a standard internal wall
  useEffect(() => {
    if (!open || walls.length === 0) return;
    const first = walls[0];
    const saved = first.wallBuild ?? (first.framingSystem || first.hasLining ? legacyWallBuild(first) : null);
    setHeight(String(first.height || 2.7));
    if (saved) {
      setBuild({ framingSystem: saved.framingSystem, faceA: saved.faceA, faceB: saved.faceB, layers: saved.layers, insulationType: saved.insulationType });
      const match = WALL_PRESETS.find(p => JSON.stringify(p.build) === JSON.stringify({ framingSystem: saved.framingSystem, faceA: saved.faceA, faceB: saved.faceB, layers: saved.layers, insulationType: saved.insulationType }));
      setPresetId(match?.id ?? 'custom');
      // Openings were saved as this wall's share; scale back up to the selection
      const totalLen = walls.reduce((sum, w) => sum + w.realValue, 0);
      const share = totalLen > 0 ? first.realValue / totalLen : 1;
      setDoors(String(Math.round((saved.doors || 0) / (share || 1))));
      setWindows(String(Math.round((saved.windows || 0) / (share || 1))));
      setWindowW(String(saved.windowWidthM || 1.2));
      setWindowH(String(saved.windowHeightM || 1.2));
      setPaint(!!saved.paint); setSkirting(!!saved.skirting); setCornice(!!saved.cornice);
    } else {
      setBuild(WALL_PRESETS[0].build); setPresetId(WALL_PRESETS[0].id);
      setDoors('0'); setWindows('0'); setWindowW('1.2'); setWindowH('1.2');
      setPaint(false); setSkirting(false); setCornice(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, walls.map(w => w.id).join(',')]);

  const h = Math.max(parseFloat(height) || 2.7, 0.1);
  const totalLM = walls.reduce((sum, w) => sum + w.realValue, 0);

  const fullBuild: WallBuild = {
    ...build,
    doors: Math.round(num(doors, 0)),
    windows: Math.round(num(windows, 0)),
    doorWidthM: 0.82, doorHeightM: 2.04,
    windowWidthM: num(windowW, 1.2), windowHeightM: num(windowH, 1.2),
    paint, skirting, cornice,
  };

  // Openings are entered for the whole selection and shared out by wall length
  const buildFor = (w: Measurement): WallBuild => {
    const share = totalLM > 0 ? w.realValue / totalLM : 0;
    return { ...fullBuild, doors: fullBuild.doors * share, windows: fullBuild.windows * share };
  };

  const preview = useMemo(() => {
    const byKey = new Map<string, WallLine>();
    for (const w of walls) {
      for (const l of wallLines(w.realValue, h, buildFor(w))) {
        const prev = byKey.get(l.key);
        byKey.set(l.key, prev ? { ...prev, qty: prev.qty + l.qty } : l);
      }
    }
    return [...byKey.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walls, h, JSON.stringify(fullBuild)]);

  const members = useMemo(() => {
    let studs = 0, plates = 0, noggings = 0, jamb = 0, lintels = 0;
    for (const w of walls) {
      const m = wallMembers(w.realValue, h, 450, buildFor(w));
      if (!m) continue;
      studs += m.studs; plates += m.plateLM; noggings += m.noggingLM; jamb += m.jambStuds; lintels += m.lintelLM;
    }
    return { studs, plates, noggings, jamb: Math.ceil(fullBuild.doors * 2 + fullBuild.windows * 2), lintels };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walls, h, JSON.stringify(fullBuild)]);

  const grossM2 = totalLM * h;
  const openM2 = openingsArea(fullBuild);
  const bricks = build.faceB === 'brick' ? Math.ceil(Math.max(0, grossM2 - openM2) * 48.4) : 0;

  const choosePreset = (p: WallPreset) => { setPresetId(p.id); setBuild(p.build); };
  const setFace = (side: 'faceA' | 'faceB', f: FaceFinish) => { setPresetId('custom'); setBuild(b => ({ ...b, [side]: f })); };

  const handleConfirm = () => {
    const updates: WallUpdate[] = walls.map(w => {
      const wb = buildFor(w);
      const lined = (f: FaceFinish) => ['pb_10', 'pb_13', 'fc_6', 'fc_9'].includes(f);
      const faces = (lined(wb.faceA) ? 1 : 0) + (lined(wb.faceB) ? 1 : 0);
      return {
        id: w.id,
        configuredMeasurement: {
          ...w,
          measurementType: 'Wall' as const,
          height: h,
          // The area comes from the height chosen here, not an older combined figure
          computedM2: undefined,
          wallBuild: wb,
          // Older screens still read these
          framingSystem: wb.framingSystem,
          hasLining: faces > 0,
          liningType: lined(wb.faceA) ? wb.faceA : lined(wb.faceB) ? wb.faceB : undefined,
          liningFaces: faces,
          hasInsulation: !!wb.insulationType,
          insulationType: wb.insulationType ?? undefined,
        },
      };
    });
    onConfirm(updates);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto z-[10002]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            Wall Setup
            <span className="text-sm font-normal text-muted-foreground">
              {walls.length} wall{walls.length !== 1 ? 's' : ''} · {totalLM.toFixed(1)} lm · {grossM2.toFixed(1)} m²
            </span>
          </DialogTitle>
        </DialogHeader>

        {walls.length > 1 && (
          <div className="max-h-28 overflow-y-auto space-y-1 rounded-md border border-border bg-muted/30 p-2">
            {walls.map((w, i) => (
              <div key={w.id} className="flex items-center justify-between text-sm px-2 py-0.5">
                <span className="text-muted-foreground truncate">{w.label || `Wall ${i + 1}`}</span>
                <span className="font-mono text-xs shrink-0 ml-2">{w.realValue.toFixed(2)} lm</span>
              </div>
            ))}
          </div>
        )}

        {/* Height */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium w-28 shrink-0">Wall height</span>
          <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="h-8 w-20 text-center font-mono text-sm" step="0.05" min="1" max="6" />
          <span className="text-sm text-muted-foreground">m</span>
          <div className="flex gap-1 ml-auto">
            {[2.4, 2.55, 2.7, 3.0].map(p => (
              <button key={p} onClick={() => setHeight(String(p))}
                className={cn('h-7 px-2.5 rounded text-xs font-mono', parseFloat(height) === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                {p}m
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div>
          <span className="text-sm font-medium mb-2 block">Wall type</span>
          <div className="grid grid-cols-3 gap-2">
            {WALL_PRESETS.map(p => (
              <button key={p.id} onClick={() => choosePreset(p)}
                className={cn('flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg border text-left',
                  presetId === p.id ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border bg-muted/30 hover:border-primary/40')}>
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Each face, frame and insulation: change any of it */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Frame</span>
            <select className={selectCls} value={build.framingSystem}
              onChange={e => { setPresetId('custom'); setBuild(b => ({ ...b, framingSystem: e.target.value })); }}>
              {Object.entries(FRAMING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              <option value="none">No framing (existing wall)</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Insulation</span>
            <select className={selectCls} value={build.insulationType ?? ''}
              onChange={e => { setPresetId('custom'); setBuild(b => ({ ...b, insulationType: e.target.value || null })); }}>
              <option value="">None</option>
              {Object.entries(INSULATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Inside face</span>
            <select className={selectCls} value={build.faceA} onChange={e => setFace('faceA', e.target.value as FaceFinish)}>
              {INSIDE_FACES.map(f => <option key={f} value={f}>{FACE_LABELS[f]}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Other face</span>
            <select className={selectCls} value={build.faceB} onChange={e => setFace('faceB', e.target.value as FaceFinish)}>
              {OTHER_FACES.map(f => <option key={f} value={f}>{FACE_LABELS[f]}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Sheets per face</span>
            <select className={selectCls} value={build.layers}
              onChange={e => { setPresetId('custom'); setBuild(b => ({ ...b, layers: Number(e.target.value) })); }}>
              <option value={1}>1 layer</option>
              <option value={2}>2 layers (fire or acoustic)</option>
            </select>
          </label>
        </div>

        {/* Openings */}
        <div className="rounded-lg border border-border p-3 text-sm space-y-2">
          <div className="font-medium">Doors and windows in {walls.length > 1 ? 'these walls' : 'this wall'}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Doors</span>
              <Input type="number" min="0" value={doors} onChange={e => setDoors(e.target.value)} className="h-8 w-16 text-center" />
              <span className="text-xs text-muted-foreground">820 x 2040</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">Windows</span>
              <Input type="number" min="0" value={windows} onChange={e => setWindows(e.target.value)} className="h-8 w-16 text-center" />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">average size</span>
              <Input type="number" min="0" step="0.1" value={windowW} onChange={e => setWindowW(e.target.value)} className="h-8 w-16 text-center" />
              <span className="text-xs text-muted-foreground">x</span>
              <Input type="number" min="0" step="0.1" value={windowH} onChange={e => setWindowH(e.target.value)} className="h-8 w-16 text-center" />
              <span className="text-xs text-muted-foreground">m</span>
            </label>
          </div>
          {openM2 > 0 && (
            <p className="text-xs text-muted-foreground">
              {openM2.toFixed(2)} m² of openings taken off linings, cladding and batts. The frame is still priced on the full wall.
            </p>
          )}
        </div>

        {/* Follow-on trades */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span className="font-medium">Also add</span>
          {[['Painting', paint, setPaint], ['Skirting', skirting, setSkirting], ['Cornice', cornice, setCornice]].map(([label, val, set]) => (
            <label key={label as string} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={val as boolean} onChange={e => (set as (v: boolean) => void)(e.target.checked)} />
              <span>{label as string}</span>
            </label>
          ))}
        </div>

        {walls.some(w => w.addedToEstimate) && (
          <p className="text-xs text-amber-400">
            {walls.length > 1 ? 'Some of these walls are' : 'This wall is'} already in the estimate. Its wall lines will be replaced by the ones below; framing members you added separately stay.
          </p>
        )}

        {/* Preview: exactly what will be added */}
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 space-y-1.5">
          <div className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest mb-1">Lines that will be added to the estimate</div>
          {preview.map(l => (
            <div key={l.key} className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {l.name}: <span className="text-foreground/80">{l.key.startsWith('cladding') && bricks ? `Brick veneer, about ${bricks} bricks` : l.material}</span>
              </span>
              <span className="font-mono font-medium shrink-0">{l.qty.toFixed(1)} {unitText(l.unit)}</span>
            </div>
          ))}
          {preview.length === 0 && <p className="text-sm text-muted-foreground">Nothing to add: choose a frame or a face finish.</p>}
          {build.framingSystem !== 'none' && (
            <div className="border-t border-amber-400/10 pt-1.5 text-xs text-muted-foreground">
              Frame members at 450 centres: {members.studs + members.jamb} studs x {h.toFixed(2)} m
              {members.jamb > 0 ? ` (incl. ${members.jamb} jamb studs)` : ''}, plates {members.plates.toFixed(1)} m, noggings {members.noggings.toFixed(1)} m
              {members.lintels > 0 ? `, lintels ${members.lintels.toFixed(1)} m` : ''}. Check sizes against AS 1684 for your wind class.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!height || parseFloat(height) <= 0 || preview.length === 0}>
            Add {walls.length} wall{walls.length !== 1 ? 's' : ''} to estimate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
