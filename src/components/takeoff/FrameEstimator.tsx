import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, TriangleAlert, SendToBack, Hammer,
  Zap, Pencil, Plus, Scan, Check, X, Trash2, Circle, CircleDot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Measurement, CostItem, WallOpening } from '@/lib/takeoff/types';
import {
  FrameSettings, DEFAULT_FRAME_SETTINGS, FrameMaterial, StudSpacing,
  CeilingHeight, TimberSize, SteelSize, extractWallSegments, calculateFramingBOM,
} from '@/lib/takeoff/framingCalculations';
import { detectWallsFromPDF, DetectedWall, DetectionResult } from '@/lib/takeoff/wallDetection';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FrameSectionConfig {
  id: string;
  name: string;
  settings: FrameSettings;
}

interface FrameEstimatorProps {
  measurements: Measurement[];
  isCalibrated: boolean;
  unitsPerMetre: number | null;
  onAddCostItems?: (items: CostItem[]) => void;
  pdfUrl?: string;
  pageIndex?: number;
  projectId?: string;
  onWallDetected?: (m: Measurement) => void;
  onActiveSectionChange?: (sectionId: string | null) => void;
  onUpdateMeasurement?: (id: string, updates: Partial<Measurement>) => void;
}

// ─── Inline option row (replaces pill toggle) ─────────────────────────────────

function OptionRow<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="text-[10px] text-muted-foreground/40 w-14 shrink-0 text-right">{label}</span>
      <div className="flex gap-2.5 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'text-[11px] transition-colors leading-none',
              value === opt.value
                ? 'text-foreground font-medium'
                : 'text-muted-foreground/40 hover:text-muted-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Wall list with opening deductions ───────────────────────────────────────

function WallList({
  walls, measurements, onUpdateMeasurement,
}: {
  walls: import('@/lib/takeoff/framingCalculations').WallSegment[];
  measurements: Measurement[];
  onUpdateMeasurement?: (id: string, updates: Partial<Measurement>) => void;
}) {
  const [expandedWallId, setExpandedWallId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newOpeningType, setNewOpeningType] = useState<'door' | 'window'>('door');
  const [newOpeningWidth, setNewOpeningWidth] = useState('');

  const commitOpening = (wallId: string, currentOpenings: WallOpening[]) => {
    const w = parseInt(newOpeningWidth, 10);
    if (isNaN(w) || w < 400 || w > 6000) { toast.error('Width must be 400–6000mm'); return; }
    const next: WallOpening[] = [
      ...currentOpenings,
      { id: crypto.randomUUID(), type: newOpeningType, widthMm: w },
    ];
    onUpdateMeasurement?.(wallId, { wallOpenings: next });
    setNewOpeningWidth('');
    setAddingTo(null);
  };

  const removeOpening = (wallId: string, openingId: string, currentOpenings: WallOpening[]) => {
    onUpdateMeasurement?.(wallId, { wallOpenings: currentOpenings.filter(o => o.id !== openingId) });
  };

  return (
    <div className="space-y-0.5">
      {walls.map((w, idx) => {
        const m = measurements.find(m => m.id === w.id);
        const openings = m?.wallOpenings ?? [];
        const isExpanded = expandedWallId === w.id;
        const isAdding = addingTo === w.id;

        return (
          <div key={w.id}>
            <div className="flex items-center gap-1.5 text-xs py-0.5 group">
              <span className="text-muted-foreground/50 w-4 text-right shrink-0 font-mono text-[10px]">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="font-mono tabular-nums w-12 shrink-0">{w.lengthM.toFixed(2)}m</span>
              <button
                onClick={() => {
                  if (!m || !onUpdateMeasurement) return;
                  onUpdateMeasurement(m.id, {
                    wallClassification: m.wallClassification === 'external' ? 'internal' : 'external',
                  });
                }}
                className={cn(
                  'text-[10px] font-medium transition-colors shrink-0',
                  w.classification === 'external'
                    ? 'text-amber-400/80 hover:text-amber-300'
                    : 'text-sky-400/80 hover:text-sky-300',
                )}
                title="Click to toggle ext / int"
              >
                {w.classification === 'external' ? 'ext' : 'int'}
              </button>
              {w.hasRakingPlate && <span className="text-[9px] text-purple-300 font-medium">raking</span>}
              <div className="flex-1" />
              {openings.length > 0 && (
                <button
                  onClick={() => setExpandedWallId(isExpanded ? null : w.id)}
                  className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  {openings.length} opening{openings.length !== 1 ? 's' : ''}
                </button>
              )}
              {onUpdateMeasurement && (
                <button
                  onClick={() => { setAddingTo(isAdding ? null : w.id); setExpandedWallId(w.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground/50 hover:text-foreground"
                  title="Add door or window opening"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Expanded openings list */}
            {isExpanded && openings.length > 0 && (
              <div className="ml-6 space-y-px mb-1">
                {openings.map(o => (
                  <div key={o.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground group/op">
                    <span className={o.type === 'door' ? 'text-violet-400' : 'text-cyan-400'}>{o.type}</span>
                    <span className="font-mono tabular-nums">{o.widthMm}mm</span>
                    <button
                      onClick={() => removeOpening(w.id, o.id, openings)}
                      className="opacity-0 group-hover/op:opacity-100 transition-opacity text-muted-foreground/40 hover:text-red-400 ml-auto"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline add opening form */}
            {isAdding && (
              <div className="ml-6 flex items-center gap-1.5 mb-1">
                <button
                  onClick={() => setNewOpeningType(newOpeningType === 'door' ? 'window' : 'door')}
                  className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors shrink-0',
                    newOpeningType === 'door' ? 'border-violet-600 text-violet-400' : 'border-cyan-600 text-cyan-400')}
                >
                  {newOpeningType}
                </button>
                <Input
                  type="number"
                  placeholder="width mm"
                  value={newOpeningWidth}
                  onChange={e => setNewOpeningWidth(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitOpening(w.id, openings);
                    if (e.key === 'Escape') { setAddingTo(null); setNewOpeningWidth(''); }
                  }}
                  className="h-5 text-[10px] px-1 w-20"
                  autoFocus
                />
                <button
                  onClick={() => commitOpening(w.id, openings)}
                  className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => { setAddingTo(null); setNewOpeningWidth(''); }}
                  className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── BOM row ──────────────────────────────────────────────────────────────────

function BOMRow({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between py-1 px-2 text-xs', sub && 'pl-4 text-muted-foreground')}>
      <span>{label}</span>
      <span className="font-mono font-semibold tabular-nums">
        {typeof value === 'number' ? value.toFixed(unit === 'LM' ? 2 : 0) : value}
        {unit && <span className="text-muted-foreground ml-1 font-normal">{unit}</span>}
      </span>
    </div>
  );
}

// ─── Section settings ─────────────────────────────────────────────────────────

function SectionSettings({ settings, onChange }: { settings: FrameSettings; onChange: (s: FrameSettings) => void }) {
  const set = (patch: Partial<FrameSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="pl-1 space-y-0.5 py-1">
      <OptionRow
        label="material"
        options={[{ label: 'Timber', value: 'timber' }, { label: 'Steel', value: 'steel' }]}
        value={settings.material}
        onChange={(v) => set({ material: v as FrameMaterial })}
      />
      <OptionRow
        label="spacing"
        options={[{ label: '300', value: '300' }, { label: '450', value: '450' }, { label: '600mm', value: '600' }]}
        value={String(settings.studSpacingMm)}
        onChange={(v) => set({ studSpacingMm: Number(v) as StudSpacing })}
      />
      <OptionRow
        label="height"
        options={[{ label: '2400', value: '2400' }, { label: '2440', value: '2440' }, { label: '2700', value: '2700' }, { label: '3000', value: '3000' }]}
        value={String(settings.ceilingHeightMm)}
        onChange={(v) => set({ ceilingHeightMm: Number(v) as CeilingHeight })}
      />
      <OptionRow
        label={settings.material === 'timber' ? 'size' : 'section'}
        options={settings.material === 'timber'
          ? [{ label: '70×35', value: '70x35' }, { label: '90×35', value: '90x35' }, { label: '90×45', value: '90x45' }, { label: '140×45', value: '140x45' }]
          : [{ label: '64mm', value: '64mm' }, { label: '76mm', value: '76mm' }, { label: '92mm', value: '92mm' }]}
        value={settings.material === 'timber' ? settings.timberSize : settings.steelSize}
        onChange={(v) => settings.material === 'timber' ? set({ timberSize: v as TimberSize }) : set({ steelSize: v as SteelSize })}
      />
      <div className="flex items-center gap-2 pt-1 pl-16">
        <Switch
          checked={settings.doubleTopPlate}
          onCheckedChange={(v) => set({ doubleTopPlate: v })}
          className="scale-75 origin-left"
        />
        <span className="text-[11px] text-muted-foreground/60">
          double top plate
        </span>
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SECTION: FrameSectionConfig = {
  id: 'default',
  name: 'Section 1',
  settings: { ...DEFAULT_FRAME_SETTINGS },
};

function makeSection(name: string): FrameSectionConfig {
  return { id: crypto.randomUUID(), name, settings: { ...DEFAULT_FRAME_SETTINGS } };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FrameEstimator({
  measurements, isCalibrated, unitsPerMetre, onAddCostItems,
  pdfUrl, pageIndex, projectId, onWallDetected, onActiveSectionChange, onUpdateMeasurement,
}: FrameEstimatorProps) {
  const storageKey = projectId ? `frame_sections_${projectId}` : null;

  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<'auto' | 'manual'>('manual');

  const [sections, setSections] = useState<FrameSectionConfig[]>(() => {
    if (!storageKey) return [{ ...DEFAULT_SECTION }];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as FrameSectionConfig[];
    } catch { /* ignore */ }
    return [{ ...DEFAULT_SECTION }];
  });

  const [activeSectionId, setActiveSectionId] = useState<string | null>(sections[0]?.id ?? null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState<Set<string>>(new Set());
  const [fixingsOpen, setFixingsOpen] = useState<Set<string>>(new Set());
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [pendingWalls, setPendingWalls] = useState<DetectedWall[]>([]);
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [scanWarning, setScanWarning] = useState<string | null>(null);

  // Persist sections
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(sections)); } catch { /* ignore */ }
  }, [sections, storageKey]);

  // Notify parent of active section
  useEffect(() => {
    onActiveSectionChange?.(mode === 'manual' ? activeSectionId : null);
  }, [activeSectionId, mode, onActiveSectionChange]);

  // Wall segments grouped by section
  const wallsBySection = useMemo(() => {
    const map = new Map<string, ReturnType<typeof extractWallSegments>>();
    const unsectioned = measurements.filter(m =>
      !m.frameSectionId && m.wallThickness !== undefined &&
      m.worldPoints?.length >= 2 && m.realValue > 0,
    );
    for (const sec of sections) {
      const sectionMs = measurements.filter(m =>
        m.frameSectionId === sec.id && m.wallThickness !== undefined &&
        m.worldPoints?.length >= 2 && m.realValue > 0,
      );
      const all = sec.id === sections[0]?.id ? [...sectionMs, ...unsectioned] : sectionMs;
      map.set(sec.id, extractWallSegments(all));
    }
    return map;
  }, [measurements, sections]);

  const bomBySection = useMemo(() => {
    if (!isCalibrated || !unitsPerMetre) return new Map<string, ReturnType<typeof calculateFramingBOM>>();
    const map = new Map<string, ReturnType<typeof calculateFramingBOM>>();
    for (const sec of sections) {
      const walls = wallsBySection.get(sec.id) ?? [];
      if (walls.length > 0) map.set(sec.id, calculateFramingBOM(walls, sec.settings, unitsPerMetre));
    }
    return map;
  }, [wallsBySection, sections, isCalibrated, unitsPerMetre]);

  const totalWalls = useMemo(() =>
    [...wallsBySection.values()].reduce((s, w) => s + w.length, 0),
    [wallsBySection],
  );

  // ─── Section operations ────────────────────────────────────────────────────

  const addSection = () => {
    const sec = makeSection(`Section ${sections.length + 1}`);
    setSections(prev => [...prev, sec]);
    setActiveSectionId(sec.id);
  };

  const removeSection = (id: string) => {
    if (sections.length === 1) { toast.error('Need at least one section'); return; }
    setSections(prev => prev.filter(s => s.id !== id));
    if (activeSectionId === id) setActiveSectionId(sections.find(s => s.id !== id)?.id ?? null);
  };

  const updateSectionSettings = (id: string, s: FrameSettings) =>
    setSections(prev => prev.map(sec => sec.id === id ? { ...sec, settings: s } : sec));

  const commitName = () => {
    if (!editingNameId) return;
    setSections(prev => prev.map(s =>
      s.id === editingNameId ? { ...s, name: editingNameValue.trim() || s.name } : s,
    ));
    setEditingNameId(null);
  };

  const toggleSet = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  // ─── Auto-detect ──────────────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    if (!pdfUrl || pageIndex === undefined || !unitsPerMetre) {
      toast.error('PDF must be loaded and calibrated first');
      return;
    }
    setScanning(true);
    setScanWarning(null);
    try {
      const result: DetectionResult = await detectWallsFromPDF(pdfUrl, pageIndex, unitsPerMetre);
      if (result.tooMany) {
        const via = result.method === 'vector' ? 'vector paths' : 'pixel scan';
        setScanWarning(`Too many lines detected via ${via} (${result.rawCount}). This page may be a site or landscape plan — switch to a floor plan page or use Manual mode.`);
        setPendingWalls([]);
      } else if (result.walls.length === 0) {
        setScanWarning('No walls detected. Try a floor plan page (1:100–1:200 scale) or use Manual mode.');
        setPendingWalls([]);
      } else {
        setScanWarning(null);
        setPendingWalls(result.walls);
        setRejectedIds(new Set());
      }
    } catch (err) {
      toast.error('Detection failed — ensure the plan is fully loaded');
      console.error(err);
    } finally {
      setScanning(false);
    }
  }, [pdfUrl, pageIndex, unitsPerMetre]);

  const confirmWalls = useCallback(() => {
    if (!onWallDetected || !activeSectionId) return;
    const kept = pendingWalls.filter(w => !rejectedIds.has(w.id));
    for (const w of kept) {
      const m: Measurement = {
        id: crypto.randomUUID(),
        type: 'line',
        worldPoints: w.worldPoints,
        worldValue: Math.hypot(
          w.worldPoints[1].x - w.worldPoints[0].x,
          w.worldPoints[1].y - w.worldPoints[0].y,
        ),
        realValue: w.realValue,
        unit: 'LM',
        color: '#f59e0b',
        label: '',
        pageIndex: pageIndex ?? 0,
        timestamp: new Date().toISOString(),
        wallThickness: 90,
        wallClassification: w.classification,
        frameSectionId: activeSectionId,
      };
      onWallDetected(m);
    }
    const secName = sections.find(s => s.id === activeSectionId)?.name ?? 'section';
    toast.success(`${kept.length} wall${kept.length !== 1 ? 's' : ''} added to ${secName}`);
    setPendingWalls([]);
    setRejectedIds(new Set());
  }, [pendingWalls, rejectedIds, onWallDetected, activeSectionId, pageIndex, sections]);

  // ─── Push BOM ─────────────────────────────────────────────────────────────

  const pushBOM = useCallback((sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId);
    const bom = bomBySection.get(sectionId);
    if (!sec || !bom || !onAddCostItems) return;

    const mat = sec.settings.material === 'timber' ? sec.settings.timberSize : sec.settings.steelSize;
    const trade = sec.settings.material === 'timber' ? 'Carpenter' : 'Steel Framer';
    const desc = `${sec.name} — ${sec.settings.material === 'timber' ? 'Timber' : 'Steel'} ${mat}`;

    const makeItem = (name: string, qty: number, unit: 'count' | 'LM'): CostItem => ({
      id: crypto.randomUUID(),
      category: 'Framing',
      name: `[${sec.name}] ${name}`,
      description: desc,
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

    const totalLM = bom.external.bottomPlateLM + bom.internal.bottomPlateLM;
    const totalTopLM = bom.external.topPlateLM + bom.internal.topPlateLM;
    const totalNoggings = bom.external.noggings + bom.internal.noggings;

    const items: CostItem[] = [
      makeItem(`${mat} Studs`, bom.totalStuds, 'count'),
      makeItem('Bottom Plate', totalLM, 'LM'),
      makeItem('Top Plate', totalTopLM, 'LM'),
      ...(bom.external.rakingPlateLM > 0 ? [makeItem('Raking Plate', bom.external.rakingPlateLM, 'LM')] : []),
      makeItem('Noggings', totalNoggings, 'count'),
      ...(bom.totalLintelLM > 0 ? [makeItem('Lintels', bom.totalLintelLM, 'LM')] : []),
    ];

    if (sec.settings.material === 'timber') {
      if (bom.fixings.nails90mm) items.push(makeItem('90mm Nails', bom.fixings.nails90mm, 'count'));
      if (bom.fixings.nails75mm) items.push(makeItem('75mm Nails (noggings)', bom.fixings.nails75mm, 'count'));
      if (bom.fixings.anchorBolts) items.push(makeItem('Anchor Bolts', bom.fixings.anchorBolts, 'count'));
    } else {
      if (bom.fixings.tekScrews) items.push(makeItem('Tek Screws', bom.fixings.tekScrews, 'count'));
      if (bom.fixings.trackAnchors) items.push(makeItem('Track Anchors', bom.fixings.trackAnchors, 'count'));
      if (bom.fixings.lBrackets) items.push(makeItem('L-Brackets', bom.fixings.lBrackets, 'count'));
    }

    onAddCostItems(items);
    toast.success(`${items.length} items from ${sec.name} → Cost Estimator`);
  }, [sections, bomBySection, onAddCostItems]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20 border-b border-border/40">
        <button
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors text-left flex-1 min-w-0"
        >
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <Hammer className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="truncate">Frame Estimator</span>
          {totalWalls > 0 && (
            <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
              {totalWalls} wall{totalWalls !== 1 ? 's' : ''}
            </Badge>
          )}
        </button>

        {/* Auto / Manual toggle */}
        <div className="flex rounded-md border border-border/50 overflow-hidden shrink-0 ml-2">
          <button
            onClick={() => setMode('auto')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors',
              mode === 'auto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <Zap className="h-3 w-3" />
            Auto
          </button>
          <button
            onClick={() => setMode('manual')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-colors border-l border-border/50',
              mode === 'manual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <Pencil className="h-3 w-3" />
            Manual
          </button>
        </div>
      </div>

      {open && (
        <div className="divide-y divide-border/30">
          {/* Calibration gate */}
          {!isCalibrated && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-950/30 text-xs text-amber-300">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              Set scale first — framing quantities need accurate wall lengths
            </div>
          )}

          {/* Auto mode */}
          {mode === 'auto' && (
            <div className="px-3 py-3 space-y-3">
              <button
                onClick={handleScan}
                disabled={scanning || !isCalibrated || !pdfUrl}
                className="w-full flex items-center justify-center gap-1.5 h-8 text-xs font-medium border border-border/60 rounded-md text-muted-foreground hover:text-foreground hover:border-border/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {scanning ? (
                  <>
                    <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Scanning…
                  </>
                ) : (
                  <>
                    <Scan className="h-3.5 w-3.5" />
                    Scan Page for Walls
                  </>
                )}
              </button>

              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                Best on floor plan pages (1:100–1:200). Site and landscape plans may return too many false positives.
              </p>

              {/* Warning banner */}
              {scanWarning && (
                <div className="flex items-start gap-2 px-2 py-2 bg-amber-950/30 border border-amber-800/30 rounded text-[11px] text-amber-300/90 leading-relaxed">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {scanWarning}
                </div>
              )}

              {/* Section selector when multiple sections */}
              {sections.length > 1 && pendingWalls.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Add to:</p>
                  <div className="flex flex-wrap gap-1">
                    {sections.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSectionId(s.id)}
                        className={cn(
                          'px-2 py-0.5 text-[11px] rounded border transition-colors',
                          activeSectionId === s.id
                            ? 'border-border text-foreground'
                            : 'border-border/40 text-muted-foreground hover:border-border/70',
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Review panel — only shows walls NOT rejected */}
              {pendingWalls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      {pendingWalls.length - rejectedIds.size} of {pendingWalls.length} kept
                      {rejectedIds.size > 0 && <span className="text-muted-foreground/50 ml-1">· {rejectedIds.size} removed</span>}
                    </p>
                    <div className="flex gap-2">
                      {rejectedIds.size > 0 && (
                        <button
                          onClick={() => setRejectedIds(new Set())}
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Restore all
                        </button>
                      )}
                      <button
                        onClick={() => setRejectedIds(new Set(pendingWalls.map(w => w.id)))}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Remove all
                      </button>
                    </div>
                  </div>

                  {/* Only show kept walls */}
                  <div className="max-h-48 overflow-y-auto space-y-px">
                    {pendingWalls.filter(w => !rejectedIds.has(w.id)).map(w => (
                      <div
                        key={w.id}
                        className="flex items-center gap-2 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted/20 transition-colors group"
                      >
                        <span className="font-mono tabular-nums w-12 shrink-0 text-foreground/80">
                          {w.realValue.toFixed(2)}m
                        </span>
                        <button
                          onClick={() => setPendingWalls(prev => prev.map(pw =>
                            pw.id === w.id
                              ? { ...pw, classification: pw.classification === 'external' ? 'internal' : 'external' as 'external' | 'internal' }
                              : pw,
                          ))}
                          className={cn(
                            'text-[10px] font-medium transition-colors shrink-0',
                            w.classification === 'external'
                              ? 'text-amber-400/80 hover:text-amber-300'
                              : 'text-sky-400/80 hover:text-sky-300',
                          )}
                        >
                          {w.classification === 'external' ? 'ext' : 'int'}
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={() => setRejectedIds(prev => new Set([...prev, w.id]))}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-red-400"
                          title="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {pendingWalls.filter(w => !rejectedIds.has(w.id)).length === 0 && (
                      <p className="text-[11px] text-muted-foreground/50 py-2 text-center">
                        All removed — click "Restore all" to undo
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={confirmWalls}
                      disabled={rejectedIds.size === pendingWalls.length || !activeSectionId}
                      className="flex items-center gap-1 px-3 h-7 text-xs font-medium border border-border/60 rounded hover:border-border/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check className="h-3 w-3" />
                      Confirm {pendingWalls.length - rejectedIds.size} wall{pendingWalls.length - rejectedIds.size !== 1 ? 's' : ''}
                    </button>
                    <button
                      onClick={() => { setPendingWalls([]); setRejectedIds(new Set()); setScanWarning(null); }}
                      className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual mode: tip when empty */}
          {mode === 'manual' && totalWalls === 0 && (
            <div className="px-3 py-3 space-y-1">
              <p className="text-[11px] text-muted-foreground/80">
                Press <kbd className="bg-muted/60 px-1.5 py-0.5 rounded text-[10px] font-mono">W</kbd> to activate the wall tool, then click two points on the plan for each wall. Tag EXT / INT in the list below.
              </p>
            </div>
          )}

          {/* Manual mode: active section selector (multi-section only) */}
          {mode === 'manual' && sections.length > 1 && (
            <div className="px-3 py-2">
              <p className="text-[10px] text-muted-foreground mb-1">Drawing into:</p>
              <div className="flex flex-wrap gap-1">
                {sections.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSectionId(s.id)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border transition-colors',
                      activeSectionId === s.id
                        ? 'border-border text-foreground'
                        : 'border-border/40 text-muted-foreground hover:border-border/70',
                    )}
                  >
                    {activeSectionId === s.id ? <CircleDot className="h-2.5 w-2.5" /> : <Circle className="h-2.5 w-2.5" />}
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sections */}
          <div className="divide-y divide-border/20">
            {sections.map(sec => {
              const walls = wallsBySection.get(sec.id) ?? [];
              const bom = bomBySection.get(sec.id) ?? null;
              const isCollapsed = collapsedSections.has(sec.id);
              const isSettingsOpen = settingsOpen.has(sec.id);
              const isFixingsOpen = fixingsOpen.has(sec.id);
              const isActiveSection = activeSectionId === sec.id;
              const extWalls = walls.filter(w => w.classification === 'external');
              const intWalls = walls.filter(w => w.classification === 'internal');

              return (
                <div key={sec.id} className={cn('transition-colors', isActiveSection && mode === 'manual' && 'bg-primary/5')}>
                  {/* Section header row */}
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <button
                      onClick={() => setCollapsedSections(prev => toggleSet(prev, sec.id))}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>

                    {editingNameId === sec.id ? (
                      <Input
                        value={editingNameValue}
                        onChange={e => setEditingNameValue(e.target.value)}
                        onBlur={commitName}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitName();
                          if (e.key === 'Escape') setEditingNameId(null);
                        }}
                        className="h-6 text-xs flex-1 px-1"
                        autoFocus
                      />
                    ) : (
                      <button
                        className="text-xs font-semibold flex-1 text-left hover:text-primary transition-colors truncate"
                        onDoubleClick={() => { setEditingNameId(sec.id); setEditingNameValue(sec.name); }}
                        onClick={() => { if (mode === 'manual') setActiveSectionId(sec.id); }}
                      >
                        {sec.name}
                        {isActiveSection && mode === 'manual' && (
                          <span className="ml-1.5 text-[9px] text-primary font-normal">(active)</span>
                        )}
                      </button>
                    )}

                    {/* Wall badges */}
                    {extWalls.length > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-900/30 text-amber-300 border border-amber-700/30 font-medium shrink-0">
                        {extWalls.length}ext
                      </span>
                    )}
                    {intWalls.length > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-sky-900/30 text-sky-300 border border-sky-700/30 font-medium shrink-0">
                        {intWalls.length}int
                      </span>
                    )}

                    {/* Material/size badge */}
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0',
                      sec.settings.material === 'timber' ? 'bg-orange-900/30 text-orange-300' : 'bg-slate-700/50 text-slate-300',
                    )}>
                      {sec.settings.material === 'timber' ? sec.settings.timberSize : sec.settings.steelSize}
                    </span>

                    {sections.length > 1 && (
                      <button
                        onClick={() => removeSection(sec.id)}
                        className="text-muted-foreground/40 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="px-3 pb-3 space-y-2.5">
                      {/* Settings toggle */}
                      <button
                        onClick={() => setSettingsOpen(prev => toggleSet(prev, sec.id))}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isSettingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Settings — {sec.settings.material === 'timber' ? 'Timber' : 'Steel'} · {sec.settings.studSpacingMm}mm · {sec.settings.ceilingHeightMm}mm
                      </button>

                      {isSettingsOpen && (
                        <SectionSettings
                          settings={sec.settings}
                          onChange={(s) => updateSectionSettings(sec.id, s)}
                        />
                      )}

                      {/* Wall list with opening deductions */}
                      {walls.length > 0 && (
                        <WallList
                          walls={walls}
                          measurements={measurements}
                          onUpdateMeasurement={onUpdateMeasurement}
                        />
                      )}

                      {walls.length === 0 && (
                        <p className="text-[11px] text-muted-foreground/60 py-0.5">
                          {mode === 'auto'
                            ? 'Scan page or switch to Manual to draw'
                            : isActiveSection
                              ? 'Press W, then draw wall lines on the plan'
                              : 'Click section name to activate for drawing'}
                        </p>
                      )}

                      {/* BOM output */}
                      {bom && (
                        <div className="space-y-2 pt-0.5">
                          {bom.external.count > 0 && (
                            <div>
                              <div className="text-[10px] text-muted-foreground/50 mb-1">
                                ext walls — {bom.external.lengthM.toFixed(2)} LM
                                {bom.external.openingCount > 0 && (
                                  <span className="text-violet-400/70 ml-1">· {bom.external.openingCount} opening{bom.external.openingCount !== 1 ? 's' : ''} deducted</span>
                                )}
                              </div>
                              <div className="border border-border/30 rounded divide-y divide-border/20 overflow-hidden">
                                <BOMRow label="Studs" value={bom.external.studs} unit="pcs" />
                                {bom.external.trimmerStuds > 0 && <BOMRow label={`Trimmers (${bom.external.openingCount} openings)`} value={bom.external.trimmerStuds} unit="pcs" sub />}
                                <BOMRow label="Bottom plate" value={bom.external.bottomPlateLM} unit="LM" />
                                <BOMRow label="Top plate" value={bom.external.topPlateLM} unit="LM" />
                                {bom.external.rakingPlateLM > 0 && (
                                  <BOMRow label="Raking plate" value={bom.external.rakingPlateLM} unit="LM" />
                                )}
                                <BOMRow label={`Noggings (${bom.external.noggingRows}r)`} value={bom.external.noggings} unit="pcs" />
                                {bom.external.lintels.length > 0 && (
                                  <BOMRow label={`Lintels (${bom.external.lintels.length})`} value={bom.external.lintels.reduce((s, l) => s + l.lm, 0)} unit="LM" />
                                )}
                              </div>
                            </div>
                          )}

                          {bom.internal.count > 0 && (
                            <div>
                              <div className="text-[10px] text-muted-foreground/50 mb-1">
                                int walls — {bom.internal.lengthM.toFixed(2)} LM
                                {bom.internal.openingCount > 0 && (
                                  <span className="text-violet-400/70 ml-1">· {bom.internal.openingCount} opening{bom.internal.openingCount !== 1 ? 's' : ''} deducted</span>
                                )}
                              </div>
                              <div className="border border-border/30 rounded divide-y divide-border/20 overflow-hidden">
                                <BOMRow label="Studs" value={bom.internal.studs} unit="pcs" />
                                {bom.internal.trimmerStuds > 0 && <BOMRow label={`Trimmers (${bom.internal.openingCount} openings)`} value={bom.internal.trimmerStuds} unit="pcs" sub />}
                                <BOMRow label="Bottom plate" value={bom.internal.bottomPlateLM} unit="LM" />
                                <BOMRow label="Top plate" value={bom.internal.topPlateLM} unit="LM" />
                                <BOMRow label={`Noggings (${bom.internal.noggingRows}r)`} value={bom.internal.noggings} unit="pcs" />
                                {bom.internal.lintels.length > 0 && (
                                  <BOMRow label={`Lintels (${bom.internal.lintels.length})`} value={bom.internal.lintels.reduce((s, l) => s + l.lm, 0)} unit="LM" />
                                )}
                              </div>
                            </div>
                          )}

                          {bom.junctions.totalExtraStuds > 0 && (
                            <div className="border border-border/30 rounded divide-y divide-border/20 overflow-hidden">
                              {bom.junctions.externalCorners > 0 && (
                                <BOMRow label={`Ext corners ×3 (${bom.junctions.externalCorners})`} value={bom.junctions.externalCorners * 3} unit="pcs" sub />
                              )}
                              {bom.junctions.internalCorners > 0 && (
                                <BOMRow label={`Int corners ×2 (${bom.junctions.internalCorners})`} value={bom.junctions.internalCorners * 2} unit="pcs" sub />
                              )}
                              {bom.junctions.tJunctions > 0 && (
                                <BOMRow label={`T-junctions ×2 (${bom.junctions.tJunctions})`} value={bom.junctions.tJunctions * 2} unit="pcs" sub />
                              )}
                            </div>
                          )}

                          {/* Totals */}
                          <div className="border border-border/50 rounded bg-muted/20 overflow-hidden">
                            <div className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold border-b border-border/30">
                              <span>Total Studs</span>
                              <span className="font-mono text-primary">{bom.totalStuds}</span>
                            </div>
                            <BOMRow label="Bottom plate total" value={bom.external.bottomPlateLM + bom.internal.bottomPlateLM} unit="LM" />
                            <BOMRow label="Top plate total" value={bom.external.topPlateLM + bom.internal.topPlateLM} unit="LM" />
                            <BOMRow label="Noggings total" value={bom.external.noggings + bom.internal.noggings} unit="pcs" />
                            {bom.totalLintelLM > 0 && (
                              <BOMRow label={`Lintels (${bom.lintels.length})`} value={bom.totalLintelLM} unit="LM" />
                            )}
                          </div>

                          {/* Fixings */}
                          <button
                            onClick={() => setFixingsOpen(prev => toggleSet(prev, sec.id))}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {isFixingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {sec.settings.material === 'timber' ? 'Nails & Anchors' : 'Tek Screws & Brackets'}
                          </button>

                          {isFixingsOpen && (
                            <div className="border border-border/30 rounded divide-y divide-border/20 overflow-hidden">
                              {sec.settings.material === 'timber' ? (
                                <>
                                  <BOMRow label="90mm nails (stud-to-plate)" value={bom.fixings.nails90mm ?? 0} unit="pcs" />
                                  <BOMRow label="75mm nails (noggings)" value={bom.fixings.nails75mm ?? 0} unit="pcs" />
                                  <BOMRow label="Anchor bolts to slab" value={bom.fixings.anchorBolts ?? 0} unit="pcs" />
                                </>
                              ) : (
                                <>
                                  <BOMRow label="Tek screws (8-16×16mm)" value={bom.fixings.tekScrews ?? 0} unit="pcs" />
                                  <BOMRow label="Track anchors to slab" value={bom.fixings.trackAnchors ?? 0} unit="pcs" />
                                  <BOMRow label="L-brackets (corners)" value={bom.fixings.lBrackets ?? 0} unit="pcs" />
                                </>
                              )}
                            </div>
                          )}

                          <p className="text-[9px] text-muted-foreground/50">
                            {sec.settings.material === 'timber' ? 'AS1684' : 'AS3623'} · {sec.settings.doubleTopPlate ? 'double' : 'single'} top plate · {sec.settings.studSpacingMm}mm spacing
                          </p>

                          {onAddCostItems && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-xs gap-1.5"
                              onClick={() => pushBOM(sec.id)}
                            >
                              <SendToBack className="h-3 w-3" />
                              Push {sec.name} BOM to Cost Estimator
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add section */}
          <div className="px-3 py-2.5">
            <button
              onClick={addSection}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add zone (different material or area)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
