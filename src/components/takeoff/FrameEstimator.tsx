import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, TriangleAlert, SendToBack, Building2,
  Zap, Pencil, Plus, Scan, Check, X, Trash2, DoorOpen, AppWindow,
  Settings2, Layers, Circle, CircleDot, Home,
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

// ─── Material unit costs for BOM push ────────────────────────────────────────

function studUnitCost(settings: FrameSettings): number {
  const heightM = settings.ceilingHeightMm / 1000;
  if (settings.material === 'timber') return Math.round(3.85 * heightM * 100) / 100;
  return 12.50; // steel stud per piece
}

function plateUnitCost(settings: FrameSettings): number {
  return settings.material === 'timber' ? 3.85 : 4.50;
}

function noggingUnitCost(settings: FrameSettings): number {
  return settings.material === 'timber' ? 2.30 : 6.80;
}

function lintelUnitCost(): number {
  return 14.50; // LVL per LM
}

// ─── Segmented control ────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md border border-border/50 overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
            i > 0 && 'border-l border-border/50',
            value === opt.value
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Inline option row ────────────────────────────────────────────────────────

function OptionRow<T extends string>({
  label, options, value, onChange,
}: { label: string; options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-2.5 py-1 text-xs rounded border transition-colors',
              value === opt.value
                ? 'border-primary/60 bg-primary/10 text-primary font-medium'
                : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Section settings ─────────────────────────────────────────────────────────

function SectionSettings({ settings, onChange }: { settings: FrameSettings; onChange: (s: FrameSettings) => void }) {
  const set = (patch: Partial<FrameSettings>) => onChange({ ...settings, ...patch });
  return (
    <div className="space-y-2.5 py-2 px-1">
      <OptionRow
        label="Material"
        options={[{ label: 'Timber', value: 'timber' }, { label: 'Steel', value: 'steel' }]}
        value={settings.material}
        onChange={(v) => set({ material: v as FrameMaterial })}
      />
      <OptionRow
        label="Stud spacing"
        options={[{ label: '300mm', value: '300' }, { label: '450mm', value: '450' }, { label: '600mm', value: '600' }]}
        value={String(settings.studSpacingMm)}
        onChange={(v) => set({ studSpacingMm: Number(v) as StudSpacing })}
      />
      <OptionRow
        label="Ceiling ht."
        options={[
          { label: '2400', value: '2400' },
          { label: '2440', value: '2440' },
          { label: '2700', value: '2700' },
          { label: '3000', value: '3000' },
        ]}
        value={String(settings.ceilingHeightMm)}
        onChange={(v) => set({ ceilingHeightMm: Number(v) as CeilingHeight })}
      />
      <OptionRow
        label={settings.material === 'timber' ? 'Timber size' : 'Section'}
        options={settings.material === 'timber'
          ? [
              { label: '70×35', value: '70x35' },
              { label: '90×35', value: '90x35' },
              { label: '90×45', value: '90x45' },
              { label: '140×45', value: '140x45' },
            ]
          : [
              { label: '64mm', value: '64mm' },
              { label: '76mm', value: '76mm' },
              { label: '92mm', value: '92mm' },
            ]}
        value={settings.material === 'timber' ? settings.timberSize : settings.steelSize}
        onChange={(v) => settings.material === 'timber'
          ? set({ timberSize: v as TimberSize })
          : set({ steelSize: v as SteelSize })
        }
      />
      <div className="flex items-center gap-3 pt-0.5">
        <span className="text-xs text-muted-foreground w-16 shrink-0">Top plate</span>
        <div className="flex items-center gap-2">
          <Switch
            checked={settings.doubleTopPlate}
            onCheckedChange={(v) => set({ doubleTopPlate: v })}
            className="scale-90 origin-left"
          />
          <span className="text-xs text-muted-foreground">
            {settings.doubleTopPlate ? 'Double' : 'Single'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Wall list ────────────────────────────────────────────────────────────────

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
    if (isNaN(w) || w < 400 || w > 6000) {
      toast.error('Opening width must be 400–6000mm');
      return;
    }
    onUpdateMeasurement?.(wallId, {
      wallOpenings: [...currentOpenings, { id: crypto.randomUUID(), type: newOpeningType, widthMm: w }],
    });
    setNewOpeningWidth('');
    setAddingTo(null);
  };

  const removeOpening = (wallId: string, openingId: string, currentOpenings: WallOpening[]) => {
    onUpdateMeasurement?.(wallId, { wallOpenings: currentOpenings.filter(o => o.id !== openingId) });
  };

  if (walls.length === 0) return null;

  return (
    <div className="space-y-px">
      {walls.map((w, idx) => {
        const m = measurements.find(m => m.id === w.id);
        const openings = m?.wallOpenings ?? [];
        const isExpanded = expandedWallId === w.id;
        const isAdding = addingTo === w.id;
        const doorCount = openings.filter(o => o.type === 'door').length;
        const windowCount = openings.filter(o => o.type === 'window').length;

        return (
          <div key={w.id} className="rounded">
            {/* Wall row */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/20 transition-colors group">
              <span className="text-xs text-muted-foreground/50 font-mono w-4 shrink-0 select-none">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="text-xs font-mono tabular-nums text-foreground/80 w-12 shrink-0">
                {w.lengthM.toFixed(2)}m
              </span>

              {/* EXT / INT toggle */}
              <button
                onClick={() => {
                  if (!m || !onUpdateMeasurement) return;
                  onUpdateMeasurement(m.id, {
                    wallClassification: m.wallClassification === 'external' ? 'internal' : 'external',
                  });
                }}
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded border transition-colors shrink-0',
                  w.classification === 'external'
                    ? 'border-border/60 bg-muted/30 text-foreground/70 hover:bg-muted/50'
                    : 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/30',
                )}
                title="Click to toggle External / Internal"
              >
                {w.classification === 'external' ? 'EXT' : 'INT'}
              </button>

              {w.hasRakingPlate && (
                <span className="text-xs text-muted-foreground font-medium shrink-0">Raking</span>
              )}

              {/* Openings summary */}
              <div className="flex items-center gap-1.5 ml-1">
                {doorCount > 0 && (
                  <button
                    onClick={() => setExpandedWallId(isExpanded ? null : w.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <DoorOpen className="h-3 w-3 text-violet-400" />
                    {doorCount}
                  </button>
                )}
                {windowCount > 0 && (
                  <button
                    onClick={() => setExpandedWallId(isExpanded ? null : w.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <AppWindow className="h-3 w-3 text-[#E1DCC9]" />
                    {windowCount}
                  </button>
                )}
              </div>

              <div className="flex-1" />

              {/* Add opening — always visible */}
              {onUpdateMeasurement && (
                <button
                  onClick={() => {
                    setAddingTo(isAdding ? null : w.id);
                    setExpandedWallId(w.id);
                  }}
                  className={cn(
                    'flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border transition-colors shrink-0',
                    isAdding
                      ? 'border-border text-foreground bg-muted/40'
                      : 'border-border/30 text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                  title="Add door or window opening"
                >
                  <Plus className="h-3 w-3" />
                  Opening
                </button>
              )}
            </div>

            {/* Expanded openings */}
            {isExpanded && openings.length > 0 && (
              <div className="ml-8 mb-1 space-y-px">
                {openings.map(o => (
                  <div key={o.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/20 group/op">
                    {o.type === 'door'
                      ? <DoorOpen className="h-3 w-3 text-violet-400 shrink-0" />
                      : <AppWindow className="h-3 w-3 text-[#E1DCC9] shrink-0" />
                    }
                    <span className="capitalize text-muted-foreground">{o.type}</span>
                    <span className="font-mono tabular-nums text-foreground/80">{o.widthMm}mm</span>
                    <div className="flex-1" />
                    <button
                      onClick={() => removeOpening(w.id, o.id, openings)}
                      className="opacity-0 group-hover/op:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline add opening form */}
            {isAdding && (
              <div className="ml-8 mb-2 flex items-center gap-2">
                <button
                  onClick={() => setNewOpeningType(newOpeningType === 'door' ? 'window' : 'door')}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors shrink-0',
                    newOpeningType === 'door'
                      ? 'border-violet-600/50 text-violet-400 bg-violet-950/30'
                      : 'border-foreground/20 text-[#E1DCC9] bg-card/50',
                  )}
                >
                  {newOpeningType === 'door'
                    ? <DoorOpen className="h-3 w-3" />
                    : <AppWindow className="h-3 w-3" />
                  }
                  {newOpeningType === 'door' ? 'Door' : 'Window'}
                </button>
                <Input
                  type="number"
                  placeholder="Width (mm)"
                  value={newOpeningWidth}
                  onChange={e => setNewOpeningWidth(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitOpening(w.id, openings);
                    if (e.key === 'Escape') { setAddingTo(null); setNewOpeningWidth(''); }
                  }}
                  className="h-7 text-xs px-2 w-28"
                  autoFocus
                />
                <button
                  onClick={() => commitOpening(w.id, openings)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setAddingTo(null); setNewOpeningWidth(''); }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── BOM table ────────────────────────────────────────────────────────────────

function BOMTable({ label, rows }: {
  label: string;
  rows: { name: string; value: number; unit: string; sub?: boolean; note?: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5 px-1">{label}</div>
      <div className="border border-border/30 rounded overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-between px-3 py-1.5 text-xs',
              i > 0 && 'border-t border-border/20',
              row.sub && 'pl-6 bg-muted/10',
            )}
          >
            <span className={cn(row.sub ? 'text-muted-foreground' : 'text-foreground/80')}>
              {row.name}
              {row.note && <span className="text-muted-foreground/50 ml-1.5 text-[11px]">{row.note}</span>}
            </span>
            <span className="font-mono tabular-nums text-foreground font-medium">
              {typeof row.value === 'number'
                ? row.unit === 'LM' ? row.value.toFixed(2) : row.value.toFixed(0)
                : row.value
              }
              <span className="text-muted-foreground font-normal ml-1">{row.unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SECTION: FrameSectionConfig = {
  id: 'default',
  name: 'Ground Floor',
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

  // Roof truss BOM state
  const [roofOpen, setRoofOpen] = useState(false);
  const [roofAreaM2, setRoofAreaM2] = useState('');
  const [roofPitchDeg, setRoofPitchDeg] = useState('22.5');
  const [roofSpacingMm, setRoofSpacingMm] = useState('600');
  const [roofType, setRoofType] = useState<'gable' | 'hip'>('gable');
  const [roofRidgeLengthM, setRoofRidgeLengthM] = useState('');
  const [roofHipLengthM, setRoofHipLengthM] = useState('');

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

  // Roof BOM
  const roofBOM = useMemo(() => {
    const area = parseFloat(roofAreaM2);
    const pitch = parseFloat(roofPitchDeg);
    const spacing = parseFloat(roofSpacingMm);
    if (isNaN(area) || area <= 0 || isNaN(pitch) || pitch <= 0 || isNaN(spacing) || spacing <= 0) return null;
    const pitchRad = (pitch * Math.PI) / 180;
    const slopeFactor = 1 / Math.cos(pitchRad);
    const spacingM = spacing / 1000;
    const ridgeLen = parseFloat(roofRidgeLengthM);
    const ridgeLM = isNaN(ridgeLen) || ridgeLen <= 0 ? 0 : ridgeLen;
    const trussCount = ridgeLM > 0
      ? Math.ceil(ridgeLM / spacingM) + 1
      : Math.ceil(Math.sqrt(area) / spacingM) + 1;
    const rafterLM = area * slopeFactor;
    const hipLen = parseFloat(roofHipLengthM);
    const hipRafterLM = roofType === 'hip' && !isNaN(hipLen) && hipLen > 0
      ? hipLen * slopeFactor * 4
      : 0;
    return {
      trussCount,
      rafterLM: Math.round(rafterLM * 10) / 10,
      ridgeLM,
      hipRafterLM: Math.round(hipRafterLM * 10) / 10,
      slopeFactor,
    };
  }, [roofAreaM2, roofPitchDeg, roofSpacingMm, roofType, roofRidgeLengthM, roofHipLengthM]);

  // ─── Section operations ──────────────────────────────────────────────────────

  const addSection = () => {
    const names = ['First Floor', 'Garage', 'Extension', 'Granny Flat'];
    const nextName = names[sections.length - 1] ?? `Zone ${sections.length + 1}`;
    const sec = makeSection(nextName);
    setSections(prev => [...prev, sec]);
    setActiveSectionId(sec.id);
  };

  const removeSection = (id: string) => {
    if (sections.length === 1) { toast.error('At least one zone is required'); return; }
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

  // ─── Auto-detect ─────────────────────────────────────────────────────────────

  const handleScan = useCallback(async () => {
    if (!pdfUrl || pageIndex === undefined || !unitsPerMetre) {
      toast.error('PDF must be loaded and calibrated before scanning');
      return;
    }
    setScanning(true);
    setScanWarning(null);
    try {
      const result: DetectionResult = await detectWallsFromPDF(pdfUrl, pageIndex, unitsPerMetre);
      if (result.tooMany) {
        setScanWarning(
          `Too many lines detected (${result.rawCount}) via ${result.method === 'vector' ? 'vector paths' : 'pixel scan'}. ` +
          'This looks like a site or landscape plan. Try a floor plan page at 1:100–1:200 scale, or use Manual mode.'
        );
        setPendingWalls([]);
      } else if (result.walls.length === 0) {
        setScanWarning('No walls found on this page. Try a floor plan page, or switch to Manual mode and draw walls yourself.');
        setPendingWalls([]);
      } else {
        setScanWarning(null);
        setPendingWalls(result.walls);
        setRejectedIds(new Set());
      }
    } catch (err) {
      toast.error('Scan failed — make sure the plan is fully loaded');
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
    const secName = sections.find(s => s.id === activeSectionId)?.name ?? 'zone';
    toast.success(`${kept.length} wall${kept.length !== 1 ? 's' : ''} added to ${secName}`);
    setPendingWalls([]);
    setRejectedIds(new Set());
  }, [pendingWalls, rejectedIds, onWallDetected, activeSectionId, pageIndex, sections]);

  // ─── Push BOM ─────────────────────────────────────────────────────────────────

  const pushBOM = useCallback((sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId);
    const bom = bomBySection.get(sectionId);
    if (!sec || !bom || !onAddCostItems) return;

    const mat = sec.settings.material === 'timber' ? sec.settings.timberSize : sec.settings.steelSize;
    const trade = sec.settings.material === 'timber' ? 'Carpenter' : 'Steel Framer';
    const desc = `${sec.name} — ${sec.settings.material === 'timber' ? 'Timber' : 'Steel'} ${mat} @ ${sec.settings.studSpacingMm}mm`;

    const makeItem = (name: string, qty: number, unit: 'count' | 'LM', unitCost: number): CostItem => ({
      id: crypto.randomUUID(),
      category: 'Framing',
      name: `[${sec.name}] ${name}`,
      description: desc,
      unit,
      unitCost,
      quantity: Math.round(qty * 100) / 100,
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
      makeItem(`${mat} Studs`, bom.totalStuds, 'count', studUnitCost(sec.settings)),
      makeItem('Bottom Plate', totalLM, 'LM', plateUnitCost(sec.settings)),
      makeItem('Top Plate', totalTopLM, 'LM', plateUnitCost(sec.settings)),
      makeItem('Noggings', totalNoggings, 'count', noggingUnitCost(sec.settings)),
    ];

    if (bom.external.rakingPlateLM > 0) {
      items.push(makeItem('Raking Plate', bom.external.rakingPlateLM, 'LM', plateUnitCost(sec.settings)));
    }
    if (bom.totalLintelLM > 0) {
      items.push(makeItem(`Lintels (${bom.lintels.length})`, bom.totalLintelLM, 'LM', lintelUnitCost()));
    }
    if (sec.settings.material === 'timber') {
      if (bom.fixings.nails90mm) items.push(makeItem('90mm Framing Nails', bom.fixings.nails90mm, 'count', 0.12));
      if (bom.fixings.anchorBolts) items.push(makeItem('Anchor Bolts', bom.fixings.anchorBolts, 'count', 22.00));
    } else {
      if (bom.fixings.tekScrews) items.push(makeItem('Tek Screws', bom.fixings.tekScrews, 'count', 0.23));
      if (bom.fixings.trackAnchors) items.push(makeItem('Track Anchors', bom.fixings.trackAnchors, 'count', 5.50));
      if (bom.fixings.lBrackets) items.push(makeItem('L-Brackets', bom.fixings.lBrackets, 'count', 3.80));
    }

    onAddCostItems(items);
    toast.success(`${items.length} items pushed from ${sec.name} to Cost Estimator`);
  }, [sections, bomBySection, onAddCostItems]);

  const pushRoofBOM = useCallback(() => {
    if (!onAddCostItems || !roofBOM) return;
    const desc = `${roofType === 'hip' ? 'Hip' : 'Gable'} roof — ${roofPitchDeg}° pitch, ${roofSpacingMm}mm spacing`;
    const makeItem = (name: string, qty: number, unit: 'count' | 'LM', unitCost: number): CostItem => ({
      id: crypto.randomUUID(),
      category: 'Framing',
      name: `[Roof] ${name}`,
      description: desc,
      unit,
      unitCost,
      quantity: qty,
      linkedMeasurements: [],
      wasteFactor: 1.05,
      subtotal: 0,
      trade: 'Carpenter',
    });
    const items: CostItem[] = [
      makeItem('Roof Trusses', roofBOM.trussCount, 'count', 185.00),
    ];
    if (roofBOM.rafterLM > 0) items.push(makeItem('Rafter Timber', roofBOM.rafterLM, 'LM', 3.85));
    if (roofBOM.ridgeLM > 0) items.push(makeItem('Ridge Beam', roofBOM.ridgeLM, 'LM', 21.25));
    if (roofBOM.hipRafterLM > 0) items.push(makeItem('Hip Rafters', roofBOM.hipRafterLM, 'LM', 3.85));
    onAddCostItems(items);
    toast.success(`${items.length} roof items pushed to Cost Estimator`);
  }, [roofBOM, onAddCostItems, roofType, roofPitchDeg, roofSpacingMm]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-card">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-border/40 bg-muted/10">
        <button
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-2 w-full px-3 py-2 text-left"
        >
          {open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          }
          <Building2 className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
          <span className="text-sm font-semibold truncate">Frame Estimator</span>
          {totalWalls > 0 && (
            <Badge variant="secondary" className="text-xs font-normal shrink-0 ml-1">
              {totalWalls} {totalWalls === 1 ? 'wall' : 'walls'}
            </Badge>
          )}
        </button>
        <div className="px-3 pb-2">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { label: 'Auto', value: 'auto' as const, icon: <Zap className="h-3 w-3" /> },
              { label: 'Manual', value: 'manual' as const, icon: <Pencil className="h-3 w-3" /> },
            ]}
          />
        </div>
      </div>

      {open && (
        <div className="divide-y divide-border/20">

          {/* ── Calibration gate ──────────────────────────────────────────── */}
          {!isCalibrated && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border border-border/40 text-xs text-muted-foreground">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              Set the page scale first. Wall lengths require calibration for accurate quantities.
            </div>
          )}

          {/* ── Auto mode ─────────────────────────────────────────────────── */}
          {mode === 'auto' && (
            <div className="px-3 py-3 space-y-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleScan}
                disabled={scanning || !isCalibrated || !pdfUrl}
              >
                {scanning ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Scanning page…
                  </>
                ) : (
                  <>
                    <Scan className="h-3.5 w-3.5" />
                    Scan Page for Walls
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Works best on floor plans at 1:100 to 1:200 scale.
              </p>

              {scanWarning && (
                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-muted/30 border border-border/40 rounded text-xs text-muted-foreground leading-relaxed">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {scanWarning}
                </div>
              )}

              {/* Section selector when pending walls exist */}
              {sections.length > 1 && pendingWalls.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Add detected walls to:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sections.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSectionId(s.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors',
                          activeSectionId === s.id
                            ? 'border-primary/60 bg-primary/10 text-primary'
                            : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
                        )}
                      >
                        {activeSectionId === s.id
                          ? <CircleDot className="h-3 w-3" />
                          : <Circle className="h-3 w-3" />
                        }
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Review panel */}
              {pendingWalls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {pendingWalls.length - rejectedIds.size} of {pendingWalls.length} walls selected
                    </span>
                    <div className="flex gap-3">
                      {rejectedIds.size > 0 && (
                        <button
                          onClick={() => setRejectedIds(new Set())}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Restore all
                        </button>
                      )}
                      <button
                        onClick={() => setRejectedIds(new Set(pendingWalls.map(w => w.id)))}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Remove all
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-px border border-border/30 rounded p-1">
                    {pendingWalls.filter(w => !rejectedIds.has(w.id)).map(w => (
                      <div key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/20 group">
                        <span className="font-mono tabular-nums w-14 shrink-0">{w.realValue.toFixed(2)}m</span>
                        <button
                          onClick={() => setPendingWalls(prev => prev.map(pw =>
                            pw.id === w.id
                              ? { ...pw, classification: pw.classification === 'external' ? 'internal' : 'external' as 'external' | 'internal' }
                              : pw,
                          ))}
                          className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded border transition-colors shrink-0',
                            w.classification === 'external'
                              ? 'border-border/60 bg-muted/30 text-foreground/70 hover:bg-muted/50'
                              : 'border-border/40 bg-muted/10 text-muted-foreground hover:bg-muted/30',
                          )}
                        >
                          {w.classification === 'external' ? 'EXT' : 'INT'}
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={() => setRejectedIds(prev => new Set([...prev, w.id]))}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {pendingWalls.filter(w => !rejectedIds.has(w.id)).length === 0 && (
                      <p className="text-xs text-muted-foreground/50 py-2 text-center">
                        All removed — click "Restore all" to undo
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={confirmWalls}
                      disabled={rejectedIds.size === pendingWalls.length || !activeSectionId}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Add {pendingWalls.length - rejectedIds.size} {pendingWalls.length - rejectedIds.size === 1 ? 'wall' : 'walls'}
                    </Button>
                    <button
                      onClick={() => { setPendingWalls([]); setRejectedIds(new Set()); setScanWarning(null); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Manual mode: empty tip ─────────────────────────────────────── */}
          {mode === 'manual' && totalWalls === 0 && (
            <div className="px-3 py-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Press <kbd className="bg-muted/60 px-1.5 py-0.5 rounded text-xs font-mono">W</kbd> to activate the wall tool, then click two points on the plan for each wall. Label each wall EXT or INT after drawing.
              </p>
            </div>
          )}

          {/* ── Manual mode: active section selector ──────────────────────── */}
          {mode === 'manual' && sections.length > 1 && (
            <div className="px-3 py-2.5 space-y-1.5">
              <p className="text-xs text-muted-foreground">Drawing into:</p>
              <div className="flex flex-wrap gap-1.5">
                {sections.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSectionId(s.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors',
                      activeSectionId === s.id
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    {activeSectionId === s.id
                      ? <CircleDot className="h-3 w-3" />
                      : <Circle className="h-3 w-3" />
                    }
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Sections ───────────────────────────────────────────────────── */}
          <div>
            {sections.map(sec => {
              const walls = wallsBySection.get(sec.id) ?? [];
              const bom = bomBySection.get(sec.id) ?? null;
              const isCollapsed = collapsedSections.has(sec.id);
              const isSettingsOpen = settingsOpen.has(sec.id);
              const isFixingsOpen = fixingsOpen.has(sec.id);
              const isActive = activeSectionId === sec.id;
              const extWalls = walls.filter(w => w.classification === 'external');
              const intWalls = walls.filter(w => w.classification === 'internal');
              const totalLM = walls.reduce((s, w) => s + w.lengthM, 0);
              const mat = sec.settings.material === 'timber' ? sec.settings.timberSize : sec.settings.steelSize;

              // Build consolidated BOM rows
              const wallBOMRows = bom ? [
                { name: 'Studs', value: bom.totalStuds, unit: 'pcs' },
                ...(bom.external.trimmerStuds + bom.internal.trimmerStuds > 0
                  ? [{ name: 'Trimmer studs', value: bom.external.trimmerStuds + bom.internal.trimmerStuds, unit: 'pcs', sub: true }]
                  : []),
                { name: 'Bottom plate', value: bom.external.bottomPlateLM + bom.internal.bottomPlateLM, unit: 'LM' },
                { name: 'Top plate', value: bom.external.topPlateLM + bom.internal.topPlateLM, unit: 'LM' },
                ...(bom.external.rakingPlateLM > 0
                  ? [{ name: 'Raking plate', value: bom.external.rakingPlateLM, unit: 'LM', sub: true }]
                  : []),
                { name: 'Noggings', value: bom.external.noggings + bom.internal.noggings, unit: 'pcs' },
                ...(bom.totalLintelLM > 0
                  ? [{ name: `Lintels`, value: bom.totalLintelLM, unit: 'LM', note: `${bom.lintels.length} openings` }]
                  : []),
              ] : [];

              const fixingRows = bom ? (
                sec.settings.material === 'timber' ? [
                  { name: '90mm framing nails', value: bom.fixings.nails90mm ?? 0, unit: 'pcs' },
                  { name: '75mm nogging nails', value: bom.fixings.nails75mm ?? 0, unit: 'pcs' },
                  { name: 'Anchor bolts to slab', value: bom.fixings.anchorBolts ?? 0, unit: 'pcs' },
                ] : [
                  { name: 'Tek screws (8-16×16)', value: bom.fixings.tekScrews ?? 0, unit: 'pcs' },
                  { name: 'Track anchors to slab', value: bom.fixings.trackAnchors ?? 0, unit: 'pcs' },
                  { name: 'L-brackets', value: bom.fixings.lBrackets ?? 0, unit: 'pcs' },
                ]
              ) : [];

              return (
                <div
                  key={sec.id}
                  className={cn(
                    'border-b border-border/20 last:border-0 transition-colors',
                    isActive && mode === 'manual' && 'bg-primary/5',
                  )}
                >
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      onClick={() => setCollapsedSections(prev => toggleSet(prev, sec.id))}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {isCollapsed
                        ? <ChevronRight className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />
                      }
                    </button>

                    <Layers className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />

                    {editingNameId === sec.id ? (
                      <Input
                        value={editingNameValue}
                        onChange={e => setEditingNameValue(e.target.value)}
                        onBlur={commitName}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitName();
                          if (e.key === 'Escape') setEditingNameId(null);
                        }}
                        className="h-7 text-sm flex-1 px-2"
                        autoFocus
                      />
                    ) : (
                      <button
                        className="text-sm font-medium flex-1 text-left hover:text-primary transition-colors truncate"
                        onDoubleClick={() => { setEditingNameId(sec.id); setEditingNameValue(sec.name); }}
                        onClick={() => { if (mode === 'manual') setActiveSectionId(sec.id); }}
                        title="Double-click to rename"
                      >
                        {sec.name}
                        {isActive && mode === 'manual' && (
                          <span className="ml-2 text-[11px] text-primary font-normal">active</span>
                        )}
                      </button>
                    )}

                    {/* Summary badges */}
                    {walls.length > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {extWalls.length > 0 && (
                          <span className="text-xs text-foreground/60">
                            {extWalls.length} ext
                          </span>
                        )}
                        {extWalls.length > 0 && intWalls.length > 0 && (
                          <span className="text-muted-foreground/30">·</span>
                        )}
                        {intWalls.length > 0 && (
                          <span className="text-xs text-muted-foreground/70">
                            {intWalls.length} int
                          </span>
                        )}
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-xs font-mono text-muted-foreground/70">
                          {totalLM.toFixed(1)} LM
                        </span>
                      </div>
                    )}

                    {/* Material badge */}
                    <span className="text-xs px-2 py-0.5 rounded border font-medium shrink-0 border-border/50 bg-muted/20 text-muted-foreground">
                      {mat}
                    </span>

                    {sections.length > 1 && (
                      <button
                        onClick={() => removeSection(sec.id)}
                        className="text-muted-foreground/30 hover:text-destructive transition-colors shrink-0 ml-1"
                        title="Remove zone"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="px-3 pb-4 space-y-4">

                      {/* Settings toggle */}
                      <button
                        onClick={() => setSettingsOpen(prev => toggleSet(prev, sec.id))}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        <span>
                          {sec.settings.material === 'timber' ? 'Timber' : 'Steel'} · {sec.settings.studSpacingMm}mm centres · {sec.settings.ceilingHeightMm}mm ceiling
                        </span>
                        {isSettingsOpen
                          ? <ChevronDown className="h-3 w-3 ml-auto" />
                          : <ChevronRight className="h-3 w-3 ml-auto" />
                        }
                      </button>

                      {isSettingsOpen && (
                        <div className="border border-border/30 rounded p-3 bg-muted/10">
                          <SectionSettings
                            settings={sec.settings}
                            onChange={(s) => updateSectionSettings(sec.id, s)}
                          />
                        </div>
                      )}

                      {/* Wall list */}
                      {walls.length > 0 && (
                        <WallList
                          walls={walls}
                          measurements={measurements}
                          onUpdateMeasurement={onUpdateMeasurement}
                        />
                      )}

                      {walls.length === 0 && (
                        <p className="text-xs text-muted-foreground/60">
                          {mode === 'auto'
                            ? 'Scan the page above to detect walls automatically'
                            : isActive
                              ? 'Press W then draw wall lines on the plan'
                              : 'Click the zone name to activate, then press W to draw'
                          }
                        </p>
                      )}

                      {/* BOM */}
                      {bom && walls.length > 0 && (
                        <div className="space-y-3 pt-1">
                          <BOMTable
                            label="Wall framing quantities"
                            rows={wallBOMRows}
                          />

                          {/* Fixings */}
                          <button
                            onClick={() => setFixingsOpen(prev => toggleSet(prev, sec.id))}
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronRight className={cn('h-3 w-3 transition-transform', isFixingsOpen && 'rotate-90')} />
                            {sec.settings.material === 'timber' ? 'Nails & anchors' : 'Tek screws & brackets'}
                          </button>

                          {isFixingsOpen && (
                            <BOMTable label="" rows={fixingRows} />
                          )}

                          <p className="text-xs text-muted-foreground/40">
                            {sec.settings.material === 'timber' ? 'AS1684' : 'AS3623'} · {sec.settings.doubleTopPlate ? 'Double' : 'Single'} top plate
                          </p>

                          {onAddCostItems && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full gap-2"
                              onClick={() => pushBOM(sec.id)}
                            >
                              <SendToBack className="h-3.5 w-3.5" />
                              Push {sec.name} BOM to Estimate
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

          {/* ── Add zone ────────────────────────────────────────────────────── */}
          <div className="px-3 py-2.5">
            <button
              onClick={addSection}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add zone
              <span className="text-muted-foreground/40">— for first floor, garage, or different framing spec</span>
            </button>
          </div>

          {/* ── Roof Truss BOM ──────────────────────────────────────────────── */}
          <div>
            <button
              onClick={() => setRoofOpen(p => !p)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/20 transition-colors text-left"
            >
              {roofOpen
                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              <Home className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              <span className="text-sm font-medium">Roof Truss BOM</span>
              {roofBOM && (
                <span className="ml-auto text-xs font-mono text-foreground/60">
                  {roofBOM.trussCount} trusses
                </span>
              )}
            </button>

            {roofOpen && (
              <div className="px-3 pb-4 space-y-4">
                <div className="space-y-3">
                  <OptionRow
                    label="Roof type"
                    options={[
                      { label: 'Gable', value: 'gable' as const },
                      { label: 'Hip', value: 'hip' as const },
                    ]}
                    value={roofType}
                    onChange={setRoofType}
                  />
                  <OptionRow
                    label="Pitch"
                    options={[
                      { label: '15°', value: '15' },
                      { label: '22.5°', value: '22.5' },
                      { label: '25°', value: '25' },
                      { label: '30°', value: '30' },
                      { label: '35°', value: '35' },
                    ]}
                    value={roofPitchDeg}
                    onChange={setRoofPitchDeg}
                  />
                  <OptionRow
                    label="Spacing"
                    options={[
                      { label: '450mm', value: '450' },
                      { label: '600mm', value: '600' },
                      { label: '900mm', value: '900' },
                      { label: '1200mm', value: '1200' },
                    ]}
                    value={roofSpacingMm}
                    onChange={setRoofSpacingMm}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Roof area</span>
                    <Input
                      type="number"
                      placeholder="m²"
                      value={roofAreaM2}
                      onChange={e => setRoofAreaM2(e.target.value)}
                      className="h-8 text-xs flex-1"
                      min="0"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Ridge length</span>
                    <Input
                      type="number"
                      placeholder="m"
                      value={roofRidgeLengthM}
                      onChange={e => setRoofRidgeLengthM(e.target.value)}
                      className="h-8 text-xs flex-1"
                      min="0"
                    />
                  </div>
                  {roofType === 'hip' && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">Hip length</span>
                      <Input
                        type="number"
                        placeholder="m per hip"
                        value={roofHipLengthM}
                        onChange={e => setRoofHipLengthM(e.target.value)}
                        className="h-8 text-xs flex-1"
                        min="0"
                      />
                    </div>
                  )}
                </div>

                {roofBOM && (
                  <div className="space-y-3">
                    <BOMTable
                      label="Roof quantities"
                      rows={[
                        { name: 'Trusses', value: roofBOM.trussCount, unit: 'pcs' },
                        ...(roofBOM.rafterLM > 0 ? [{ name: 'Rafter timber', value: roofBOM.rafterLM, unit: 'LM' }] : []),
                        ...(roofBOM.ridgeLM > 0 ? [{ name: 'Ridge beam', value: roofBOM.ridgeLM, unit: 'LM' }] : []),
                        ...(roofBOM.hipRafterLM > 0 ? [{ name: 'Hip rafters ×4', value: roofBOM.hipRafterLM, unit: 'LM' }] : []),
                      ]}
                    />
                    <p className="text-xs text-muted-foreground/40">
                      {roofPitchDeg}° pitch · slope factor ×{roofBOM.slopeFactor.toFixed(3)}
                    </p>
                    {onAddCostItems && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={pushRoofBOM}
                      >
                        <SendToBack className="h-3.5 w-3.5" />
                        Push Roof BOM to Estimate
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
