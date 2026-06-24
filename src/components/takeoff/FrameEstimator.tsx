import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, TriangleAlert, SendToBack, Hammer } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Measurement, CostItem } from '@/lib/takeoff/types';
import {
  FrameSettings,
  DEFAULT_FRAME_SETTINGS,
  FrameMaterial,
  StudSpacing,
  CeilingHeight,
  TimberSize,
  SteelSize,
  extractWallSegments,
  calculateFramingBOM,
  FramingBOM,
} from '@/lib/takeoff/framingCalculations';

interface FrameEstimatorProps {
  measurements: Measurement[];
  isCalibrated: boolean;
  unitsPerMetre: number | null;
  onAddCostItems?: (items: CostItem[]) => void;
}

interface RowProps {
  label: string;
  value: string | number;
  unit?: string;
  sub?: boolean;
}

function BOMRow({ label, value, unit, sub }: RowProps) {
  return (
    <div className={cn('flex items-center justify-between py-1 text-xs', sub && 'pl-4 text-muted-foreground')}>
      <span>{label}</span>
      <span className="font-mono font-semibold tabular-nums">
        {typeof value === 'number' ? value.toFixed(unit === 'LM' ? 2 : 0) : value}
        {unit && <span className="text-muted-foreground ml-1 font-normal">{unit}</span>}
      </span>
    </div>
  );
}

function SectionTable({
  title,
  bom,
  color,
}: {
  title: string;
  bom: ReturnType<typeof calculateFramingBOM>['external'];
  color: string;
}) {
  if (bom.count === 0) return null;
  return (
    <div className="mb-3">
      <div className={cn('text-[10px] font-semibold uppercase tracking-widest mb-1 px-1', color)}>
        {title} — {bom.lengthM.toFixed(2)} LM · {bom.count} run{bom.count !== 1 ? 's' : ''}
      </div>
      <div className="border border-border/40 rounded-md divide-y divide-border/30 overflow-hidden">
        <BOMRow label="Studs" value={bom.studs} unit="pcs" />
        <BOMRow label="Bottom plate" value={bom.bottomPlateLM} unit="LM" />
        <BOMRow label="Top plate" value={bom.topPlateLM} unit="LM" />
        {bom.rakingPlateLM > 0 && (
          <BOMRow label="Raking plate" value={bom.rakingPlateLM} unit="LM" />
        )}
        <BOMRow label={`Noggings (${bom.noggingRows} row${bom.noggingRows > 1 ? 's' : ''})`} value={bom.noggings} unit="pcs" />
      </div>
    </div>
  );
}

export function FrameEstimator({ measurements, isCalibrated, unitsPerMetre, onAddCostItems }: FrameEstimatorProps) {
  const [open, setOpen] = useState(true);
  const [fixingsOpen, setFixingsOpen] = useState(false);
  const [settings, setSettings] = useState<FrameSettings>(DEFAULT_FRAME_SETTINGS);

  const walls = useMemo(() => extractWallSegments(measurements), [measurements]);

  const bom = useMemo<FramingBOM | null>(() => {
    if (!isCalibrated || !unitsPerMetre || walls.length === 0) return null;
    return calculateFramingBOM(walls, settings, unitsPerMetre);
  }, [walls, settings, isCalibrated, unitsPerMetre]);

  const extCount = walls.filter(w => w.classification === 'external').length;
  const intCount = walls.filter(w => w.classification === 'internal').length;

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Hammer className="h-3.5 w-3.5 text-amber-400" />
          <span>Frame Estimator</span>
          {walls.length > 0 && (
            <Badge variant="secondary" className="text-[10px] font-normal">
              {walls.length} wall{walls.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {extCount > 0 && (
            <Badge className="text-[10px] font-normal bg-amber-700/30 text-amber-300 border-amber-700/40">
              {extCount} ext
            </Badge>
          )}
          {intCount > 0 && (
            <Badge className="text-[10px] font-normal bg-sky-700/30 text-sky-300 border-sky-700/40">
              {intCount} int
            </Badge>
          )}
        </div>
        {bom ? (
          <span className="text-xs text-muted-foreground font-normal">
            {bom.totalStuds} studs · {(bom.external.lengthM + bom.internal.lengthM).toFixed(1)} LM
          </span>
        ) : walls.length === 0 ? (
          <span className="text-[10px] text-muted-foreground/60">No walls yet</span>
        ) : null}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/40">

          {/* No walls yet — onboarding prompt */}
          {walls.length === 0 && (
            <div className="mt-3 px-3 py-3 bg-slate-800/60 border border-slate-700/60 rounded-md space-y-2">
              <p className="text-xs font-semibold text-amber-300">How to use Frame Estimator</p>
              <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Select the <span className="text-white font-medium">Wall-line tool</span> from the toolbar</li>
                <li>Draw each wall segment on the plan</li>
                <li>Tag each wall <span className="text-amber-300 font-medium">EXT</span> or <span className="text-sky-300 font-medium">INT</span> in the list below</li>
                <li>BOM auto-generates — push it to Cost Estimator</li>
              </ol>
            </div>
          )}

          {/* Calibration gate */}
          {!isCalibrated && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-amber-950/40 border border-amber-700/40 rounded-md text-xs text-amber-300">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              Set scale first — framing quantities depend on accurate wall lengths
            </div>
          )}

          {/* Double top plate toggle */}
          <div className="flex items-center gap-3 mt-3 px-1">
            <Switch
              id="dtp-toggle"
              checked={settings.doubleTopPlate}
              onCheckedChange={(v) => setSettings(s => ({ ...s, doubleTopPlate: v }))}
            />
            <Label htmlFor="dtp-toggle" className="text-xs cursor-pointer">
              Double top plate {settings.doubleTopPlate ? <span className="text-amber-400">(on)</span> : <span className="text-muted-foreground">(single)</span>}
            </Label>
          </div>

          {/* Project-level settings */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Material</p>
              <Select
                value={settings.material}
                onValueChange={(v) => setSettings(s => ({ ...s, material: v as FrameMaterial }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="timber">Timber</SelectItem>
                  <SelectItem value="steel">Steel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Stud Spacing</p>
              <Select
                value={String(settings.studSpacingMm)}
                onValueChange={(v) => setSettings(s => ({ ...s, studSpacingMm: Number(v) as StudSpacing }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">300 mm</SelectItem>
                  <SelectItem value="450">450 mm</SelectItem>
                  <SelectItem value="600">600 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Ceiling Height</p>
              <Select
                value={String(settings.ceilingHeightMm)}
                onValueChange={(v) => setSettings(s => ({ ...s, ceilingHeightMm: Number(v) as CeilingHeight }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2400">2400 mm</SelectItem>
                  <SelectItem value="2440">2440 mm</SelectItem>
                  <SelectItem value="2700">2700 mm</SelectItem>
                  <SelectItem value="3000">3000 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                {settings.material === 'timber' ? 'Timber Size' : 'Steel Size'}
              </p>
              {settings.material === 'timber' ? (
                <Select
                  value={settings.timberSize}
                  onValueChange={(v) => setSettings(s => ({ ...s, timberSize: v as TimberSize }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="70x35">70×35 mm</SelectItem>
                    <SelectItem value="90x35">90×35 mm</SelectItem>
                    <SelectItem value="90x45">90×45 mm</SelectItem>
                    <SelectItem value="140x45">140×45 mm</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={settings.steelSize}
                  onValueChange={(v) => setSettings(s => ({ ...s, steelSize: v as SteelSize }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="64mm">64 mm C-stud</SelectItem>
                    <SelectItem value="76mm">76 mm C-stud</SelectItem>
                    <SelectItem value="92mm">92 mm C-stud</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* BOM output */}
          {bom && (
            <div className="space-y-1">
              <SectionTable title="External Walls" bom={bom.external} color="text-amber-400" />
              <SectionTable title="Internal Walls" bom={bom.internal} color="text-sky-400" />

              {/* Corner & junction studs */}
              {(bom.junctions.externalCorners > 0 || bom.junctions.internalCorners > 0 || bom.junctions.tJunctions > 0) && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest mb-1 px-1 text-muted-foreground">
                    Junctions (detected)
                  </div>
                  <div className="border border-border/40 rounded-md divide-y divide-border/30 overflow-hidden">
                    {bom.junctions.externalCorners > 0 && (
                      <BOMRow label={`Ext. corners ×3 studs (${bom.junctions.externalCorners})`} value={bom.junctions.externalCorners * 3} unit="pcs" />
                    )}
                    {bom.junctions.internalCorners > 0 && (
                      <BOMRow label={`Int. corners ×2 studs (${bom.junctions.internalCorners})`} value={bom.junctions.internalCorners * 2} unit="pcs" />
                    )}
                    {bom.junctions.tJunctions > 0 && (
                      <BOMRow label={`T-junctions ×2 studs (${bom.junctions.tJunctions})`} value={bom.junctions.tJunctions * 2} unit="pcs" />
                    )}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="border border-border/60 rounded-md divide-y divide-border/40 bg-muted/20">
                <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
                  <span>Total Studs</span>
                  <span className="font-mono text-primary">{bom.totalStuds}</span>
                </div>
                <BOMRow
                  label="Total Bottom Plate"
                  value={(bom.external.bottomPlateLM + bom.internal.bottomPlateLM).toFixed(2)}
                  unit="LM"
                />
                <BOMRow
                  label="Total Top Plate"
                  value={(bom.external.topPlateLM + bom.internal.topPlateLM).toFixed(2)}
                  unit="LM"
                />
                {bom.external.rakingPlateLM > 0 && (
                  <BOMRow
                    label="Total Raking Plate"
                    value={bom.external.rakingPlateLM.toFixed(2)}
                    unit="LM"
                  />
                )}
                <BOMRow
                  label="Total Noggings"
                  value={bom.external.noggings + bom.internal.noggings}
                  unit="pcs"
                />
              </div>

              {/* Fixings (collapsible) */}
              <button
                onClick={() => setFixingsOpen(p => !p)}
                className="w-full flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-2 py-1"
              >
                {fixingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {settings.material === 'timber' ? 'Nails & Anchors' : 'Tek Screws & Brackets'}
              </button>

              {fixingsOpen && (
                <div className="border border-border/40 rounded-md divide-y divide-border/30 overflow-hidden">
                  {settings.material === 'timber' ? (
                    <>
                      <BOMRow label="90mm nails (stud-to-plate)" value={bom.fixings.nails90mm ?? 0} unit="pcs" />
                      <BOMRow label="75mm nails (noggings)" value={bom.fixings.nails75mm ?? 0} unit="pcs" />
                      <BOMRow label="Anchor bolts to slab" value={bom.fixings.anchorBolts ?? 0} unit="pcs" />
                    </>
                  ) : (
                    <>
                      <BOMRow label="Tek screws (8-16 × 16mm)" value={bom.fixings.tekScrews ?? 0} unit="pcs" />
                      <BOMRow label="Track anchors to slab" value={bom.fixings.trackAnchors ?? 0} unit="pcs" />
                      <BOMRow label="L-brackets (corners)" value={bom.fixings.lBrackets ?? 0} unit="pcs" />
                    </>
                  )}
                </div>
              )}

              {/* AS standard note */}
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                {settings.material === 'timber'
                  ? `Calculated per AS1684 · ${settings.doubleTopPlate ? 'double' : 'single'} top plate · 1 nogging row ≤2700mm`
                  : `Calculated per AS3623 · ${settings.doubleTopPlate ? 'double' : 'single'} top track · 1 nogging row ≤2700mm`}
              </p>

              {/* Push to Cost Estimator */}
              {onAddCostItems && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3 h-8 text-xs gap-1.5"
                  onClick={() => {
                    if (!bom) return;
                    const totalLM = bom.external.bottomPlateLM + bom.internal.bottomPlateLM;
                    const totalTopLM = bom.external.topPlateLM + bom.internal.topPlateLM;
                    const totalNoggings = bom.external.noggings + bom.internal.noggings;
                    const mat = settings.material === 'timber' ? settings.timberSize : settings.steelSize;
                    const trade = settings.material === 'timber' ? 'Carpenter' : 'Steel Framer';
                    const makeItem = (name: string, qty: number, unit: 'count' | 'LM'): CostItem => ({
                      id: crypto.randomUUID(),
                      category: 'Framing',
                      name,
                      description: `${settings.material === 'timber' ? 'Timber' : 'Steel'} framing — ${mat}`,
                      unit,
                      unitCost: 0,
                      quantity: qty,
                      linkedMeasurements: [],
                      wasteFactor: 1.05,
                      subtotal: 0,
                      trade,
                      materialWastePercent: 5,
                      labourWastePercent: 10,
                      hourlyRate: 65,
                    });
                    const items: CostItem[] = [
                      makeItem(`${mat} Studs`, bom.totalStuds, 'count'),
                      makeItem('Bottom Plate', totalLM, 'LM'),
                      makeItem('Top Plate', totalTopLM, 'LM'),
                      ...(bom.external.rakingPlateLM > 0 ? [makeItem('Raking Plate', bom.external.rakingPlateLM, 'LM')] : []),
                      makeItem('Noggings', totalNoggings, 'count'),
                    ];
                    if (settings.material === 'timber') {
                      if (bom.fixings.nails90mm) items.push(makeItem('90mm Nails', bom.fixings.nails90mm, 'count'));
                      if (bom.fixings.anchorBolts) items.push(makeItem('Anchor Bolts', bom.fixings.anchorBolts, 'count'));
                    } else {
                      if (bom.fixings.tekScrews) items.push(makeItem('Tek Screws', bom.fixings.tekScrews, 'count'));
                      if (bom.fixings.trackAnchors) items.push(makeItem('Track Anchors', bom.fixings.trackAnchors, 'count'));
                    }
                    onAddCostItems(items);
                    toast.success(`${items.length} framing items added to Cost Estimator — enter unit prices to complete`);
                  }}
                >
                  <SendToBack className="h-3.5 w-3.5" />
                  Push BOM to Cost Estimator
                </Button>
              )}
            </div>
          )}

          {!bom && isCalibrated && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Draw wall-line measurements to generate framing BOM
            </p>
          )}
        </div>
      )}
    </div>
  );
}
