import { useState } from 'react';
import { MousePointer, Move, Eraser, Minus, Square, Pentagon, Circle, Hash, Undo, Redo, DoorOpen, AppWindow, PenLine, Columns3, Crosshair, Spline, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ToolType } from '@/lib/takeoff/types';
import { cn } from '@/lib/utils';

interface MeasurementToolbarProps {
  activeTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  modMode?: 'wall' | 'door' | 'window' | 'custom' | null;
  onModSelect?: (mod: 'wall' | 'door' | 'window' | 'custom') => void;
  wallThicknessMm?: number;
  onWallThicknessChange?: (mm: number) => void;
  wallHatchType?: string;
  onWallHatchTypeChange?: (type: string) => void;
  wallHatchSide?: string;
  onWallHatchSideChange?: (side: string) => void;
  doorSubtype?: string;
  onDoorSubtypeChange?: (type: string) => void;
  windowSubtype?: string;
  onWindowSubtypeChange?: (type: string) => void;
  contextPanelOpen?: boolean;
  gridSnapMm?: number;
  onGridSnapChange?: (mm: number) => void;
  wallClassification?: 'external' | 'internal';
  onWallClassificationChange?: (c: 'external' | 'internal') => void;
  countName?: string;
  onCountNameChange?: (name: string) => void;
  countItemSize?: string;
  onCountItemSizeChange?: (size: string) => void;
}

const WALL_PRESETS = [64, 70, 90, 92, 110, 150];

// Mini pattern previews via CSS gradients
const HATCH_FILLS = [
  {
    id: 'none',
    label: 'Plain',
    desc: 'No fill',
    preview: undefined,
    previewClass: 'border border-dashed border-gray-500 bg-transparent',
  },
  {
    id: 'masonry',
    label: 'Masonry',
    desc: 'Brick bond',
    preview: 'repeating-linear-gradient(0deg,#92400e 0,#92400e 1px,#d97706 1px,#d97706 5px,#92400e 5px,#92400e 6px,#fbbf24 6px,#fbbf24 10px)',
    previewClass: '',
  },
  {
    id: 'plasterboard',
    label: 'Plasterboard',
    desc: 'Both faces',
    preview: 'repeating-linear-gradient(45deg,#94a3b8 0,#94a3b8 1px,#1e293b 1px,#1e293b 5px)',
    previewClass: '',
  },
  {
    id: 'fire-rated',
    label: 'Fire-Rated',
    desc: 'Dense diagonal',
    preview: 'repeating-linear-gradient(45deg,#ef4444 0,#ef4444 1px,#450a0a 1px,#450a0a 3px)',
    previewClass: '',
  },
  {
    id: 'insulation',
    label: 'Insulation',
    desc: 'Cavity batt',
    preview: 'linear-gradient(135deg,#fde68a,#f59e0b)',
    previewClass: '',
  },
  {
    id: 'cladding',
    label: 'Cladding',
    desc: 'Exterior face',
    preview: 'repeating-linear-gradient(0deg,#38bdf8 0,#38bdf8 1px,#0c4a6e 1px,#0c4a6e 4px)',
    previewClass: '',
  },
  {
    id: 'wet-area',
    label: 'Wet Area',
    desc: 'Waterproof lining',
    preview: 'repeating-linear-gradient(45deg,#3b82f6 0,#3b82f6 1px,#1e3a8a 1px,#1e3a8a 5px)',
    previewClass: '',
  },
  {
    id: 'glazing',
    label: 'Glazing',
    desc: 'Glass / curtain',
    preview: 'repeating-linear-gradient(45deg,#67e8f9 0,#67e8f9 1.5px,#164e63 1.5px,#164e63 7px)',
    previewClass: '',
  },
] as const;

const FACE_LINING_TYPES = new Set(['plasterboard', 'wet-area', 'cladding']);

const DOOR_TYPES = [
  { id: 'Internal',      label: 'Internal' },
  { id: 'Entry',         label: 'Entry' },
  { id: 'Cavity Slider', label: 'Cavity Slider' },
  { id: 'Bi-fold',       label: 'Bi-fold' },
  { id: 'French',        label: 'French' },
  { id: 'Fire Door',     label: 'Fire Door' },
] as const;

const WINDOW_TYPES = [
  { id: 'Awning',   label: 'Awning' },
  { id: 'Casement', label: 'Casement' },
  { id: 'Sliding',  label: 'Sliding' },
  { id: 'Fixed',    label: 'Fixed' },
  { id: 'Louvre',   label: 'Louvre' },
  { id: 'Skylight', label: 'Skylight' },
] as const;

export const MeasurementToolbar = ({
  activeTool,
  onToolSelect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  disabled,
  modMode = null,
  onModSelect,
  wallThicknessMm = 90,
  onWallThicknessChange,
  wallHatchType = 'none',
  onWallHatchTypeChange,
  wallHatchSide = 'both',
  onWallHatchSideChange,
  doorSubtype = 'Internal',
  onDoorSubtypeChange,
  windowSubtype = 'Awning',
  onWindowSubtypeChange,
  contextPanelOpen = true,
  gridSnapMm = 0,
  onGridSnapChange,
  wallClassification = 'internal',
  onWallClassificationChange,
  countName = '',
  onCountNameChange,
  countItemSize = '',
  onCountItemSizeChange,
}: MeasurementToolbarProps) => {
  const [customInput, setCustomInput] = useState('');
  type ModId = 'wall' | 'door' | 'window' | 'custom';

  const navigationTools = [
    { id: 'select' as const, icon: MousePointer, label: 'Select (V)' },
    { id: 'pan' as const, icon: Move, label: 'Pan (H)' },
  ];

  const measurementTools = [
    { id: 'line' as const, icon: Minus, label: 'Line (L)', color: 'bg-red-500' },
    { id: 'rectangle' as const, icon: Square, label: 'Rectangle (R)', color: 'bg-green-500' },
    { id: 'polygon' as const, icon: Pentagon, label: 'Polygon (P)', color: 'bg-blue-500' },
    { id: 'circle' as const, icon: Circle, label: 'Circle (C)', color: 'bg-purple-500' },
    { id: 'count' as const, icon: Hash, label: 'Count (N)', color: 'bg-orange-500' },
    { id: 'wall-line' as const, icon: Columns3, label: 'Wall Line (T)', color: 'bg-amber-700' },
    { id: 'arc-wall' as const, icon: Spline, label: 'Arc Wall (A) — 3 clicks: start → end → curve', color: 'bg-orange-500' },
    { id: 'offset' as const, icon: Crosshair, label: 'Reference Line (G)', color: 'bg-sky-400' },
    { id: 'text' as const, icon: Type, label: 'Text Annotation (X)', color: 'bg-yellow-500' },
  ];

  const modTools: Array<{ id: ModId; icon: React.ComponentType<{ className?: string }>; label: string; color: string; ring: string }> = [
    { id: 'door', icon: DoorOpen, label: 'Add Door (D)', color: 'bg-violet-500', ring: 'ring-violet-500' },
    { id: 'window', icon: AppWindow, label: 'Add Window (Q)', color: 'bg-cyan-500', ring: 'ring-cyan-500' },
    { id: 'custom', icon: PenLine, label: 'Custom line (draw freely, prompt to add to estimate)', color: 'bg-slate-400', ring: 'ring-slate-400' },
  ];

  const isWallTool = activeTool === 'wall-line' || activeTool === 'arc-wall';
  const isFaceLining = FACE_LINING_TYPES.has(wallHatchType || '');

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col gap-1">

        {/* ── Row 1: Tool buttons ───────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-2 bg-card border border-border rounded-lg overflow-x-auto">
          {navigationTools.map(({ id, icon: Icon, label }) => (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button aria-label={label} variant={activeTool === id ? 'default' : 'ghost'} size="icon" className="h-9 w-9 shrink-0" onClick={() => onToolSelect(id)}>
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

          <Separator orientation="vertical" className="h-6 mx-1 shrink-0" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-label="Eraser — click a measurement to delete (E)" variant={activeTool === 'eraser' ? 'destructive' : 'ghost'} size="icon" className="h-9 w-9 shrink-0" onClick={() => onToolSelect('eraser')}>
                <Eraser className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eraser — click a measurement to delete (E)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1 shrink-0" />

          {measurementTools.map(({ id, icon: Icon, label, color }) => {
            const isActive = modMode === null && activeTool === id;
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={label}
                    aria-pressed={isActive}
                    variant={isActive ? 'default' : 'ghost'}
                    size="icon"
                    className={cn('h-9 w-9 relative shrink-0', isActive && 'ring-2 ring-offset-1')}
                    onClick={() => onToolSelect(id)}
                    disabled={disabled}
                  >
                    <Icon className="h-4 w-4" />
                    <span aria-hidden="true" className={cn('absolute bottom-1 right-1 h-2 w-2 rounded-full', color)} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}

          {disabled && <Badge variant="secondary" className="ml-1 text-xs shrink-0">Set scale first</Badge>}

          <Separator orientation="vertical" className="h-6 mx-1 shrink-0" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-label="Undo (Ctrl+Z)" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onUndo} disabled={!canUndo || disabled}>
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-label="Redo (Ctrl+Y)" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onRedo} disabled={!canRedo || disabled}>
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>

          {onGridSnapChange && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1 shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-muted-foreground font-medium">Grid:</span>
                <select
                  value={gridSnapMm}
                  onChange={e => onGridSnapChange(Number(e.target.value))}
                  className="h-7 text-xs bg-background border border-border rounded px-1.5 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value={0}>Off</option>
                  <option value={500}>500mm</option>
                  <option value={600}>600mm</option>
                  <option value={1000}>1m</option>
                  <option value={2000}>2m</option>
                </select>
              </div>
            </>
          )}

          {activeTool && (
            <>
              <div className="flex-1 shrink-0 min-w-0" />
              <Separator orientation="vertical" className="h-6 mx-1.5 shrink-0" />
              <span className="text-[11px] font-semibold text-foreground/70 bg-muted border border-border px-2.5 py-0.5 rounded shrink-0 select-none whitespace-nowrap">
                {activeTool === 'select' ? 'Select' :
                 activeTool === 'pan' ? 'Pan' :
                 activeTool === 'eraser' ? 'Eraser' :
                 activeTool === 'line' ? 'Line' :
                 activeTool === 'rectangle' ? 'Rectangle' :
                 activeTool === 'polygon' ? 'Polygon' :
                 activeTool === 'circle' ? 'Circle' :
                 activeTool === 'count' ? 'Count' :
                 activeTool === 'wall-line' ? 'Wall Line' :
                 activeTool === 'arc-wall' ? 'Arc Wall' :
                 activeTool === 'offset' ? 'Ref. Line' :
                 activeTool === 'text' ? 'Text' : activeTool}
              </span>
            </>
          )}
        </div>

        {/* ── Row 2: Wall configuration (only when wall tool active) ─────── */}
        {(contextPanelOpen ?? true) && isWallTool && (
          <div className="flex items-start gap-3 px-3 py-2.5 bg-slate-800/70 border border-amber-900/40 rounded-lg">

            {/* Fill type cards */}
            {onWallHatchTypeChange && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest mb-1.5">
                  Wall Fill
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {HATCH_FILLS.map(({ id, label, desc, preview, previewClass }) => {
                    const active = wallHatchType === id;
                    return (
                      <button
                        key={id}
                        onClick={() => onWallHatchTypeChange(id)}
                        title={desc}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-all w-[72px] text-center',
                          active
                            ? 'bg-amber-900/50 ring-1 ring-amber-400/70'
                            : 'bg-slate-700/40 hover:bg-slate-700/70'
                        )}
                      >
                        <div
                          className={cn('w-full h-5 rounded-sm', previewClass)}
                          style={preview ? { background: preview } : undefined}
                        />
                        <span className={cn('text-[10px] leading-tight font-medium', active ? 'text-amber-300' : 'text-slate-300')}>
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="w-px bg-amber-900/30 self-stretch shrink-0" />

            {/* Thickness */}
            {onWallThicknessChange && (
              <div className="shrink-0">
                <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest mb-1.5">
                  Thickness
                </p>
                <div className="flex gap-1 flex-wrap">
                  {WALL_PRESETS.map(mm => (
                    <button
                      key={mm}
                      onClick={() => { onWallThicknessChange(mm); setCustomInput(''); }}
                      className={cn(
                        'h-7 px-2 rounded text-xs font-mono transition-colors',
                        wallThicknessMm === mm
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      {mm}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="10"
                    max="500"
                    placeholder="mm"
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const v = parseInt(customInput, 10);
                        if (!isNaN(v) && v >= 10) { onWallThicknessChange(v); setCustomInput(''); }
                      }
                    }}
                    onBlur={() => {
                      const v = parseInt(customInput, 10);
                      if (!isNaN(v) && v >= 10) { onWallThicknessChange(v); setCustomInput(''); }
                    }}
                    className="h-7 w-14 text-xs border border-slate-600 rounded px-1.5 bg-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Side selector — only for face lining types */}
            {isFaceLining && onWallHatchSideChange && (
              <>
                <div className="w-px bg-amber-900/30 self-stretch shrink-0" />
                <div className="shrink-0">
                  <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest mb-1.5">
                    Face
                  </p>
                  <div className="flex flex-col gap-1">
                    {([
                      { id: 'l1',   label: '◁  Left face',  title: 'Lining on left face only' },
                      { id: 'both', label: '↔  Both faces',  title: 'Lining on both faces' },
                      { id: 'l2',   label: 'Right face  ▷', title: 'Lining on right face only' },
                    ] as const).map(({ id, label, title }) => (
                      <button
                        key={id}
                        onClick={() => onWallHatchSideChange(id)}
                        title={title}
                        className={cn(
                          'h-7 px-3 rounded text-xs font-medium transition-colors text-left whitespace-nowrap',
                          wallHatchSide === id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Wall Classification — Ext vs Int */}
            {onWallClassificationChange && (
              <>
                <div className="w-px bg-amber-900/30 self-stretch shrink-0" />
                <div className="shrink-0">
                  <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest mb-1.5">
                    Type
                  </p>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onWallClassificationChange('external')}
                      className={cn(
                        'h-7 px-3 rounded text-xs font-medium transition-colors',
                        wallClassification === 'external'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      External
                    </button>
                    <button
                      onClick={() => onWallClassificationChange('internal')}
                      className={cn(
                        'h-7 px-3 rounded text-xs font-medium transition-colors',
                        wallClassification === 'internal'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      Internal
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        )}

        {/* ── Row 2a: Count category (when count tool active) ────────────── */}
        {(contextPanelOpen ?? true) && activeTool === 'count' && onCountNameChange && (
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/70 border border-orange-900/40 rounded-lg">
            <p className="text-[10px] font-semibold text-orange-400/80 uppercase tracking-widest shrink-0">
              Count
            </p>
            <div className="w-px bg-orange-900/30 self-stretch shrink-0" />
            <input
              type="text"
              placeholder="Category name (e.g. Door — Internal)"
              value={countName}
              onChange={e => onCountNameChange?.(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-muted/20 pb-0.5"
            />
            {onCountItemSizeChange && (
              <>
                <div className="w-px bg-orange-900/30 self-stretch shrink-0" />
                <input
                  type="text"
                  placeholder="Size (optional)"
                  value={countItemSize}
                  onChange={e => onCountItemSizeChange?.(e.target.value)}
                  className="w-24 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-muted/20 pb-0.5"
                />
              </>
            )}
          </div>
        )}

        {/* ── Row 2b: Door subtype (when marking door) ──────────────────── */}
        {(contextPanelOpen ?? true) && modMode === 'door' && onDoorSubtypeChange && (
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/70 border border-violet-900/40 rounded-lg">
            <p className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-widest shrink-0">
              Door Type
            </p>
            <div className="w-px bg-violet-900/30 self-stretch shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {DOOR_TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onDoorSubtypeChange(id)}
                  className={cn(
                    'h-7 px-3 rounded text-xs font-medium transition-colors',
                    doorSubtype === id
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 2c: Window subtype (when marking window) ───────────────── */}
        {(contextPanelOpen ?? true) && modMode === 'window' && onWindowSubtypeChange && (
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-800/70 border border-border rounded-lg">
            <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-widest shrink-0">
              Window Type
            </p>
            <div className="w-px bg-border/30 self-stretch shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {WINDOW_TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onWindowSubtypeChange(id)}
                  className={cn(
                    'h-7 px-3 rounded text-xs font-medium transition-colors',
                    windowSubtype === id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 3: Modifications (always visible) ───────────────────────── */}
        {(contextPanelOpen ?? true) && onModSelect && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 border border-border rounded-lg">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide shrink-0 select-none">
              Mark as:
            </span>
            {modTools.map(({ id, icon: Icon, label, color, ring }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={modMode === id ? 'default' : 'outline'}
                    size="sm"
                    className={cn('h-8 gap-1.5 shrink-0', modMode === id && `ring-2 ring-offset-1 ${ring}`)}
                    onClick={() => onModSelect(id)}
                    disabled={disabled}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium capitalize">{id === 'custom' ? 'Custom' : id}</span>
                    {id !== 'custom' && <span className={cn('h-2 w-2 rounded-full shrink-0', color)} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
            {modMode && modMode !== 'custom' && (
              <span className="text-xs text-muted-foreground ml-1 italic">
                Draw on the plan — click the line to add to estimate
              </span>
            )}
            {modMode === 'custom' && (
              <span className="text-xs text-muted-foreground ml-1 italic">
                Draw any line — you'll be asked to add it to the estimate
              </span>
            )}
          </div>
        )}

      </div>
    </TooltipProvider>
  );
};
