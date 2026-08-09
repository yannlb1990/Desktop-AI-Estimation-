import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ScanLine, Plus, CheckCheck, RefreshCw,
  Layers, ChevronDown, ChevronRight, ArrowUpRight,
  Home, AlertCircle, FileText, ShieldCheck, AlertTriangle, Info, Building2,
  Thermometer, TreePine, Droplets, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useAIPlanAnalysis, AnalysisTrade, AnalysisResult, BuildingElements, ElementSource, PendingItem } from '@/hooks/useAIPlanAnalysis';
import { CostItem } from '@/lib/takeoff/types';
import { getCachedPDF, cachePDF } from '@/lib/takeoff/pdfCache';
import { extractAnalysisPages } from '@/lib/takeoff/pdfPageExtractor';
import { buildCostItemsFromTrades } from '@/lib/takeoff/rateResolver';
import type { AustralianState } from '@/data/scopeOfWorkRates';
import { SCOPE_OF_WORK_RATES } from '@/data/scopeOfWorkRates';
import { getUserStorageKey } from '@/lib/localAuth';

// Map rateId → SOW description for trade row labels
const SOW_LOOKUP = new Map<string, string>(SCOPE_OF_WORK_RATES.map(r => [r.id, r.sow]));

export interface PlanAnalyserModalProps {
  open: boolean;
  onClose: () => void;
  planId?: string;
  pdfUrl?: string;
  pdfName?: string;
  pdfPageCount?: number;
  projectId?: string;
  projectState?: string;
  onAddCostItems: (items: Partial<CostItem>[]) => void;
}

// ── Trade category helpers ────────────────────────────────────────────────────

const RATE_PREFIX_TO_CATEGORY: Record<string, string> = {
  carp: 'Carpentry & Framing',
  elec: 'Electrical',
  plum: 'Plumbing',
  plas: 'Plastering',
  paint: 'Painting',
  tile: 'Tiling',
  conc: 'Concrete',
  roof: 'Roofing',
  brick: 'Bricklaying',
  clad: 'Cladding',
  insul: 'Insulation',
  wproof: 'Waterproofing',
  cab: 'Cabinetry',
};

const CATEGORY_COLOUR: Record<string, { bg: string; text: string; dot: string }> = {
  'Carpentry & Framing': { bg: 'bg-amber-950/40', text: 'text-amber-300', dot: 'bg-amber-400' },
  'Electrical':          { bg: 'bg-yellow-950/40', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  'Plumbing':            { bg: 'bg-blue-950/40',   text: 'text-blue-300',   dot: 'bg-blue-400'   },
  'Plastering':          { bg: 'bg-slate-800/40',  text: 'text-slate-300',  dot: 'bg-slate-400'  },
  'Painting':            { bg: 'bg-purple-950/40', text: 'text-purple-300', dot: 'bg-purple-400' },
  'Tiling':              { bg: 'bg-teal-950/40',   text: 'text-teal-300',   dot: 'bg-teal-400'   },
  'Concrete':            { bg: 'bg-stone-800/40',  text: 'text-stone-300',  dot: 'bg-stone-400'  },
  'Roofing':             { bg: 'bg-orange-950/40', text: 'text-orange-300', dot: 'bg-orange-400' },
  'Bricklaying':         { bg: 'bg-red-950/40',    text: 'text-red-300',    dot: 'bg-red-400'    },
  'Cladding':            { bg: 'bg-green-950/40',  text: 'text-green-300',  dot: 'bg-green-400'  },
  'Insulation':          { bg: 'bg-pink-950/40',   text: 'text-pink-300',   dot: 'bg-pink-400'   },
  'Waterproofing':       { bg: 'bg-cyan-950/40',   text: 'text-cyan-300',   dot: 'bg-cyan-400'   },
  'Cabinetry':           { bg: 'bg-indigo-950/40', text: 'text-indigo-300', dot: 'bg-indigo-400' },
  'General':             { bg: 'bg-zinc-800/40',   text: 'text-zinc-300',   dot: 'bg-zinc-400'   },
};

function tradeCategory(rateId: string | undefined, tradeName: string): string {
  if (rateId) {
    const prefix = rateId.split('-')[0];
    if (RATE_PREFIX_TO_CATEGORY[prefix]) return RATE_PREFIX_TO_CATEGORY[prefix];
  }
  const lw = tradeName.toLowerCase();
  if (lw.includes('carp') || lw.includes('frame') || lw.includes('timber') || lw.includes('skirting') || lw.includes('cornice') || lw.includes('deck')) return 'Carpentry & Framing';
  if (lw.includes('elec') || lw.includes('light') || lw.includes('power') || lw.includes('switch') || lw.includes('smoke')) return 'Electrical';
  if (lw.includes('plumb') || lw.includes('toilet') || lw.includes('vanity') || lw.includes('sink') || lw.includes('hot water')) return 'Plumbing';
  if (lw.includes('plaster') || lw.includes('cornice') || lw.includes('render') || lw.includes('plasterboard')) return 'Plastering';
  if (lw.includes('paint')) return 'Painting';
  if (lw.includes('tile') || lw.includes('tiling') || lw.includes('splashback')) return 'Tiling';
  if (lw.includes('concret') || lw.includes('slab') || lw.includes('footing')) return 'Concrete';
  if (lw.includes('roof') || lw.includes('gutter') || lw.includes('fascia') || lw.includes('downpipe')) return 'Roofing';
  if (lw.includes('brick') || lw.includes('block')) return 'Bricklaying';
  if (lw.includes('clad') || lw.includes('weather') || lw.includes('fc sheet')) return 'Cladding';
  if (lw.includes('insul') || lw.includes('batt')) return 'Insulation';
  if (lw.includes('water') || lw.includes('proof') || lw.includes('shower')) return 'Waterproofing';
  if (lw.includes('cab') || lw.includes('kitchen') || lw.includes('wardrobe') || lw.includes('vanity')) return 'Cabinetry';
  return 'General';
}

function groupTrades(trades: AnalysisTrade[]): Map<string, AnalysisTrade[]> {
  const map = new Map<string, AnalysisTrade[]>();
  for (const t of trades) {
    const cat = tradeCategory(t.rateId, t.trade);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(t);
  }
  return map;
}

function confidenceColour(c: number) {
  if (c >= 0.8) return 'text-emerald-400';
  if (c >= 0.6) return 'text-amber-400';
  return 'text-red-400';
}

function cleanRoomName(name: string): string {
  return name
    .replace(/^U\d+\s+/, '')
    .replace(/\s*\((?:GF|FF|Ground[^)]*|First[^)]*|Second[^)]*)[^)]*\)/gi, '')
    .trim();
}

// ── Persistence helpers ───────────────────────────────────────────────────────

// Bump when the AI output schema gains new fields — old caches without those
// fields get auto-cleared so users always see full materialSpec/nccRef/elements detail.
const ANALYSIS_CACHE_VERSION = 2;

function analysisStorageKey(projectId: string) { return getUserStorageKey(`planAnalysis_${projectId}`); }

function loadAnalysisCache(projectId: string): { result: AnalysisResult; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(analysisStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if ((parsed.version ?? 1) < ANALYSIS_CACHE_VERSION) {
      localStorage.removeItem(analysisStorageKey(projectId));
      return null;
    }
    if (!parsed?.result?.rooms || !Array.isArray(parsed.result.estimatedTrades)) {
      localStorage.removeItem(analysisStorageKey(projectId));
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveAnalysisCache(projectId: string, result: AnalysisResult) {
  try { localStorage.setItem(analysisStorageKey(projectId), JSON.stringify({ result, timestamp: Date.now(), version: ANALYSIS_CACHE_VERSION })); }
  catch { /* storage full */ }
}

function clearAnalysisCache(projectId: string) {
  localStorage.removeItem(analysisStorageKey(projectId));
}

function timeAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 min-w-[90px]">
      <span className="text-[11px] text-white/40 font-medium tracking-wide uppercase">{label}</span>
      <span className="text-xl font-bold text-white">{value}</span>
      {sub && <span className="text-[10px] text-white/30">{sub}</span>}
    </div>
  );
}

function CategorySection({
  category,
  trades,
  pushedIds,
  onPush,
  onPushAll,
  defaultOpen,
}: {
  category: string;
  trades: AnalysisTrade[];
  pushedIds: Set<string>;
  onPush: (t: AnalysisTrade) => void;
  onPushAll: (trades: AnalysisTrade[]) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const col = CATEGORY_COLOUR[category] ?? CATEGORY_COLOUR['General'];
  const allPushed = trades.every(t => pushedIds.has(t.trade + t.quantity + t.unit));

  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
      {/* Category header */}
      <button
        className={`w-full flex items-center justify-between px-4 py-2.5 ${col.bg} hover:brightness-110 transition-all`}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${col.dot} shrink-0`} />
          <span className={`text-sm font-semibold ${col.text}`}>{category}</span>
          <span className="text-[11px] text-white/30">{trades.length} item{trades.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          {!allPushed && (
            <button
              onClick={e => { e.stopPropagation(); onPushAll(trades); }}
              className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-colors"
              title="Push all in this category"
            >
              Push all
            </button>
          )}
          {allPushed && <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />}
          {open ? <ChevronDown className="h-3.5 w-3.5 text-white/30" /> : <ChevronRight className="h-3.5 w-3.5 text-white/30" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-white/[0.04]">
          {trades.map((t, i) => {
            const key = t.trade + t.quantity + t.unit;
            const pushed = pushedIds.has(key);
            const isExpanded = expandedIdx === i;
            const hasDetails = !!(t.materialSpec || t.nccRef || t.notes);
            return (
              <div key={i} className="bg-white/[0.02]">
                {/* Trade header row */}
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors group ${hasDetails ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
                  onClick={() => {
                    if (!hasDetails) return;
                    setExpandedIdx(prev => (prev === i ? null : i));
                  }}
                >
                  <div className="flex items-center gap-2 shrink-0">
                    {hasDetails ? (
                      isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-white/30" />
                        : <ChevronRight className="h-3.5 w-3.5 text-white/30" />
                    ) : <span className="w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const sowDesc = t.rateId ? SOW_LOOKUP.get(t.rateId) : undefined;
                      return sowDesc ? (
                        <>
                          <p className="text-sm text-white/90 leading-snug">{sowDesc}</p>
                          <p className="text-[10px] text-white/35 mt-0.5">{t.trade}</p>
                        </>
                      ) : (
                        <p className="text-sm text-white/90">{t.trade}</p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-white/60 tabular-nums">{t.quantity} {t.unit}</span>
                    <span className={`text-xs font-medium tabular-nums px-1.5 py-0.5 rounded ${
                      t.confidence >= 0.8
                        ? 'text-emerald-400'
                        : t.confidence >= 0.6
                          ? 'text-amber-400'
                          : 'text-red-400 bg-red-950/40 border border-red-900/40'
                    }`}>
                      {Math.round(t.confidence * 100)}%
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); onPush(t); }}
                      disabled={pushed}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                        pushed
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 cursor-default'
                          : 'border-white/20 text-white/50 hover:border-cyan-400 hover:text-cyan-400 hover:bg-cyan-500/10 group-hover:border-white/30 group-hover:text-white/70'
                      }`}
                      title={pushed ? 'Added to estimate' : 'Add to estimate'}
                    >
                      {pushed ? <CheckCheck className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="mx-4 mb-3 rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-3 space-y-2.5">
                    {t.materialSpec && (
                      <div>
                        <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" />
                          Material / Specification
                        </p>
                        <p className="text-[13px] text-cyan-300 leading-snug">{t.materialSpec}</p>
                      </div>
                    )}
                    {t.nccRef && (
                      <div>
                        <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <ShieldCheck className="h-3 w-3" />
                          NCC 2022 Reference
                        </p>
                        <p className="text-[13px] text-amber-300 leading-snug">{t.nccRef}</p>
                      </div>
                    )}
                    {t.notes && (
                      <div>
                        <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Notes</p>
                        <p className="text-[13px] text-white/60 leading-snug">{t.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Elements Found panel (modal version — wider layout) ──────────────────────

const STRUCTURE_LABELS: Record<string, string> = {
  timber_frame: 'Timber Frame', steel_frame: 'Steel Frame',
  brick_veneer: 'Brick Veneer', double_brick: 'Double Brick', unknown: 'Undetected',
};
const ROOF_LABELS: Record<string, string> = {
  hip: 'Hip', gable: 'Gable', skillion: 'Skillion', flat: 'Flat',
  dutch_gable: 'Dutch Gable', unknown: 'Undetected',
};
const COVER_LABELS: Record<string, string> = {
  colorbond: 'Colorbond Steel', concrete_tile: 'Concrete Tile',
  terracotta: 'Terracotta Tile', zincalume: 'Zincalume', unknown: 'Undetected',
};
const CLAD_LABELS: Record<string, string> = {
  brick_veneer: 'Brick Veneer', weatherboard: 'Weatherboard',
  fc_sheet: 'FC Sheet', render: 'Render', unknown: 'Undetected',
};
const FOUND_LABELS: Record<string, string> = {
  slab_on_ground: 'Slab on Ground', suspended_floor: 'Suspended Floor',
  pier_and_beam: 'Pier & Beam', unknown: 'Undetected',
};

function ElementCard({ icon, title, nccRef, children }: {
  icon: React.ReactNode; title: string; nccRef?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">{icon}<span className="text-sm font-semibold">{title}</span></div>
        {nccRef && <span className="text-[10px] text-white/30">{nccRef}</span>}
      </div>
      {children}
    </div>
  );
}

function ElementRow({ label, value, sub, source }: {
  label: string; value?: string | number; sub?: string; source?: ElementSource;
}) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-white/50">{label}</span>
      <div className="text-right flex items-start gap-1.5">
        <div>
          <span className="text-xs font-medium text-white/85">{value}</span>
          {sub && <span className="text-[10px] text-white/35 block">{sub}</span>}
        </div>
        {source && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-1 py-0.5 cursor-default shrink-0 mt-0.5">
                  p.{source.pageIndex}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                className="max-w-[260px] bg-[#1A110A] border border-white/10 text-white/80 shadow-xl z-[10030]"
              >
                <p className="text-[10px] text-white/40 mb-1">Page {source.pageIndex} · from drawing</p>
                <p className="text-[11px] leading-relaxed italic">&ldquo;{source.excerpt}&rdquo;</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

function ModalElementsPanel({ elements, elementSources }: {
  elements?: BuildingElements;
  elementSources?: ElementSource[];
}) {
  if (!elements) {
    return (
      <div className="py-12 text-center text-white/40 text-sm">
        No element data detected. Re-analyse the plan to populate building elements.
      </div>
    );
  }

  const srcMap = new Map<string, ElementSource>(
    (elementSources ?? []).map(s => [s.field, s])
  );
  const src = (field: string) => srcMap.get(field);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
      {/* Structure */}
      <ElementCard icon={<Home className="h-4 w-4 text-cyan-400" />} title="Structure" nccRef="NCC Vol 2 H1">
        <ElementRow label="Frame type" value={elements.structureType ? STRUCTURE_LABELS[elements.structureType] : undefined} source={src('structureType')} />
        <ElementRow label="External cladding" value={elements.externalCladding ? CLAD_LABELS[elements.externalCladding] : undefined} source={src('externalCladding')} />
        <ElementRow label="Foundation" value={elements.foundationType ? FOUND_LABELS[elements.foundationType] : undefined} source={src('foundationType')} />
        <ElementRow label="Wall height" value={elements.wallHeight ? `${elements.wallHeight} m` : undefined} source={src('wallHeight')} />
      </ElementCard>

      {/* Framing spec */}
      <ElementCard icon={<TreePine className="h-4 w-4 text-amber-400" />} title="Framing Specification" nccRef="AS 1684 · NCC H1.3">
        <ElementRow label="Stud size" value={elements.studSize} source={src('studSize')} />
        <ElementRow label="Timber grade" value={elements.timberGrade} source={src('timberGrade')} />
        <ElementRow
          label="Stud spacing"
          value={elements.studSpacing ? `${elements.studSpacing}mm c/c` : undefined}
          sub={elements.studSpacing === 450 ? 'Upper floor / high load / cyclonic' : 'Standard residential'}
          source={src('studSpacing')}
        />
        {elements.studSpacing && (
          <div className="mt-1 rounded-md bg-amber-900/20 border border-amber-700/30 px-3 py-2">
            <p className="text-[11px] text-amber-300/80">
              Full spec: {elements.studSize ?? '90×45'} {elements.timberGrade ?? 'MGP10'} @ {elements.studSpacing}mm c/c
              with top/bottom plates and noggings @ 1350mm c/c
            </p>
          </div>
        )}
      </ElementCard>

      {/* NCC Insulation */}
      <ElementCard icon={<Thermometer className="h-4 w-4 text-emerald-400" />} title="NCC Insulation Requirements" nccRef="NCC Vol 2 H6.3">
        {elements.climateZone !== undefined && (
          <ElementRow label="Climate zone" value={`Zone ${elements.climateZone}`} sub="Detected from plan location" />
        )}
        <ElementRow label="Ceiling insulation" value={elements.ceilingRValue ? `R${elements.ceilingRValue} minimum` : undefined} />
        <ElementRow label="Wall insulation" value={elements.wallRValue ? `R${elements.wallRValue} minimum` : undefined} />
        {elements.ceilingRValue && (
          <div className="mt-1 rounded-md bg-emerald-900/20 border border-emerald-700/30 px-3 py-2">
            <p className="text-[11px] text-emerald-300/80">
              Specify ceiling batts: R{elements.ceilingRValue} (glass wool or polyester) per NCC Vol 2 H6.3
              {elements.wallRValue ? ` · Wall batts: R${elements.wallRValue}` : ''}
            </p>
          </div>
        )}
      </ElementCard>

      {/* Roof */}
      <ElementCard icon={<Building2 className="h-4 w-4 text-violet-400" />} title="Roof">
        <ElementRow label="Roof type" value={elements.roofType ? ROOF_LABELS[elements.roofType] : undefined} source={src('roofType')} />
        <ElementRow label="Cover material" value={elements.roofCover ? COVER_LABELS[elements.roofCover] : undefined} source={src('roofCover')} />
        <ElementRow label="Pitch" value={elements.roofPitch !== undefined ? `${elements.roofPitch}°` : undefined} source={src('roofPitch')} />
      </ElementCard>

      {/* Wet areas */}
      {elements.wetAreas && elements.wetAreas.length > 0 && (
        <div className="md:col-span-2">
          <ElementCard icon={<Droplets className="h-4 w-4 text-blue-400" />} title="Wet Areas (Waterproofing Required)" nccRef="NCC F2.2 · AS 3740">
            <div className="flex flex-wrap gap-2 pt-1">
              {elements.wetAreas.map((area, i) => (
                <span key={i} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-700/40 rounded-md px-2.5 py-1">
                  {area}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-white/40 mt-2">
              Each wet area requires Class I waterproofing membrane per AS 3740 prior to tiling.
            </p>
          </ElementCard>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function PlanAnalyserModal({
  open,
  onClose,
  planId,
  pdfUrl,
  pdfName,
  pdfPageCount,
  projectId,
  projectState,
  onAddCostItems,
}: PlanAnalyserModalProps) {
  const { analysePages, loading, result, error, reset, setResult } = useAIPlanAnalysis();
  const [statusMsg, setStatusMsg] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [pushedIds, setPushedIds] = useState<Set<string>>(new Set());
  const [roomsOpen, setRoomsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quantities' | 'elements' | 'scope'>('quantities');
  const hasAutoTriggered = useRef(false);
  const state = (projectState as AustralianState) ?? 'QLD';

  // Load cached result on mount
  useEffect(() => {
    if (!open || !projectId) return;
    const cached = loadAnalysisCache(projectId);
    if (cached) {
      setResult(cached.result);
      setCachedAt(cached.timestamp);
      hasAutoTriggered.current = true;
    }
  }, [open, projectId]);

  // Auto-trigger analysis when modal opens with no cached result
  useEffect(() => {
    if (!open || hasAutoTriggered.current) return;
    if (!planId && !pdfUrl) return;
    hasAutoTriggered.current = true;
    handleAnalyse();
  }, [open]);

  // Save to cache whenever we get a new result
  useEffect(() => {
    if (!result || !projectId || cachedAt !== null) return;
    saveAnalysisCache(projectId, result);
    setCachedAt(Date.now());
  }, [result, projectId]);

  const handleAnalyse = useCallback(async () => {
    if (projectId) clearAnalysisCache(projectId);
    setCachedAt(null);
    setStatusMsg('');
    setLocalError(null);
    reset();

    // Try IndexedDB first; fall back to fetching from Supabase public URL
    let file: File | null = null;
    let resolvedPageCount = pdfPageCount ?? 1;

    if (planId) {
      try {
        setStatusMsg('Loading plan…');
        const cached = await getCachedPDF(planId);
        if (cached) {
          file = new File([cached.data], cached.name, { type: 'application/pdf' });
          resolvedPageCount = cached.pageCount;
        } else if (pdfUrl?.startsWith('https://')) {
          // PDF not in IndexedDB (e.g. fresh browser) — fetch from Supabase public URL
          setStatusMsg('Fetching plan from cloud…');
          const resp = await fetch(pdfUrl);
          if (!resp.ok) throw new Error(`Could not fetch plan (${resp.status})`);
          const data = await resp.arrayBuffer();
          const name = pdfName ?? 'plan.pdf';
          resolvedPageCount = pdfPageCount ?? 1;
          await cachePDF(planId, data, name, resolvedPageCount);
          file = new File([data], name, { type: 'application/pdf' });
        } else {
          throw new Error('Plan not found in cache. Please re-upload the PDF to use this feature.');
        }
      } catch (err) {
        setStatusMsg('');
        setLocalError(err instanceof Error ? err.message : String(err));
        return;
      }
    } else if (pdfUrl?.startsWith('https://')) {
      try {
        setStatusMsg('Fetching plan from cloud…');
        const resp = await fetch(pdfUrl);
        if (!resp.ok) throw new Error(`Could not fetch plan (${resp.status})`);
        const data = await resp.arrayBuffer();
        file = new File([data], pdfName ?? 'plan.pdf', { type: 'application/pdf' });
      } catch (err) {
        setStatusMsg('');
        setLocalError(err instanceof Error ? err.message : String(err));
        return;
      }
    }

    if (!file) {
      setLocalError('No plan available. Please upload a PDF first.');
      return;
    }

    try {
      setStatusMsg('Rendering pages…');
      const pages = await extractAnalysisPages(file, 50);
      setPageCount(pages.length);
      setStatusMsg(`Analysing ${pages.length} page${pages.length > 1 ? 's' : ''} across 3 parallel passes…`);
      const newResult = await analysePages(
        pages,
        { state, projectType: 'residential' },
        (done, total) => {
          setStatusMsg(`${done} of ${total} analysis passes complete…`);
        }
      );
      if (newResult && projectId) {
        saveAnalysisCache(projectId, newResult);
        setCachedAt(Date.now());
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatusMsg('');
    }
  }, [planId, pdfUrl, pdfName, pdfPageCount, projectId, state, analysePages, reset]);

  const handleReanalyse = () => {
    hasAutoTriggered.current = false;
    setPageCount(null);
    setLocalError(null);
    setPushedIds(new Set());
    if (projectId) clearAnalysisCache(projectId);
    setCachedAt(null);
    reset();
    setTimeout(() => handleAnalyse(), 0);
  };

  const pushTrade = (t: AnalysisTrade) => {
    try {
      const items = buildCostItemsFromTrades([t], state);
      onAddCostItems(items);
      const key = t.trade + t.quantity + t.unit;
      setPushedIds(prev => new Set([...prev, key]));
      toast.success(`${t.trade} added to estimate`, { duration: 2000 });
    } catch (err) {
      toast.error('Could not add item. Check the console for details.');
      console.error('[PlanAnalyser] pushTrade error:', err);
    }
  };

  const pushAll = () => {
    if (!result) return;
    try {
      const items = buildCostItemsFromTrades(result.estimatedTrades, state);
      onAddCostItems(items);
      const allKeys = new Set(result.estimatedTrades.map(t => t.trade + t.quantity + t.unit));
      setPushedIds(allKeys);
      toast.success(`${items.length} items added to estimate`);
    } catch (err) {
      toast.error('Could not add items. Check the console for details.');
      console.error('[PlanAnalyser] pushAll error:', err);
    }
  };

  const pushCategory = (trades: AnalysisTrade[]) => {
    try {
      const items = buildCostItemsFromTrades(trades, state);
      onAddCostItems(items);
      const keys = trades.map(t => t.trade + t.quantity + t.unit);
      setPushedIds(prev => new Set([...prev, ...keys]));
      toast.success(`${items.length} items added to estimate`, { duration: 2000 });
    } catch (err) {
      toast.error('Could not add items. Check the console for details.');
      console.error('[PlanAnalyser] pushCategory error:', err);
    }
  };

  // Keyboard escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const tradeGroups = result ? groupTrades(result.estimatedTrades) : null;
  const displayError = localError ?? error;
  const isAnalysing = loading || !!statusMsg;
  const allPushed = result ? result.estimatedTrades.every(t => pushedIds.has(t.trade + t.quantity + t.unit)) : false;

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] flex flex-col"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Dark overlay — pointer-events-none so it never intercepts clicks on the panel */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-none" />

      {/* Modal panel — stopPropagation prevents the outer onClick from closing when clicking inside */}
      <div
        className="relative z-10 flex flex-col w-full h-full max-w-7xl mx-auto my-0 md:my-6 md:h-[calc(100vh-48px)] bg-background md:rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] bg-background/90 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <ScanLine className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Plan Intelligence</h2>
              {pdfName && <p className="text-[11px] text-white/35 mt-0.5 truncate max-w-[240px]">{pdfName}</p>}
            </div>
            <Badge className="text-[10px] px-1.5 py-0.5 bg-white/[0.06] text-white/40 border-white/[0.12]">Beta</Badge>
            {pageCount && pageCount > 1 && (
              <span className="flex items-center gap-1 text-[11px] text-white/30">
                <Layers className="h-3 w-3" />{pageCount} pages
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cachedAt && !isAnalysing && (
              <span className="text-[11px] text-white/30 hidden sm:block">
                Analysed {timeAgo(cachedAt)}
              </span>
            )}
            {result && !isAnalysing && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs text-white/50 hover:text-white hover:bg-white/5"
                onClick={handleReanalyse}
              >
                <RefreshCw className="h-3 w-3" />
                Re-analyse
              </Button>
            )}
            {result && !allPushed && (
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
                onClick={pushAll}
              >
                <ArrowUpRight className="h-3 w-3" />
                Push All to Estimate
              </Button>
            )}
            {result && allPushed && (
              <span className="flex items-center gap-1.5 text-[12px] text-emerald-400 font-medium">
                <CheckCheck className="h-3.5 w-3.5" />
                All added
              </span>
            )}
            <div className="w-px h-5 bg-white/[0.08] mx-0.5" />
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.08] transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading state */}
          {isAnalysing && (
            <div className="flex flex-col items-center justify-center gap-5 h-full min-h-[400px]">
              <div className="relative flex items-center justify-center">
                {/* Outer pulse ring */}
                <div className="absolute w-24 h-24 rounded-2xl border border-cyan-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                {/* Mid ring */}
                <div className="absolute w-20 h-20 rounded-2xl border border-cyan-400/10" />
                {/* Metricore logo */}
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden"
                  style={{ boxShadow: '0 0 32px rgba(34,211,238,0.15)' }}>
                  <svg viewBox="-11.25 -52.5 235 235" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="-11.25" y="-52.5" width="235" height="235" rx="44" fill="#1F150C"/>
                    <path
                      d="M 18,110 L 18,65 C 18,10 72,10 72,65 C 72,120 126,120 126,65 C 126,10 180,10 180,65 L 180,110"
                      stroke="#E1DCC9"
                      strokeWidth="35"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="197" cy="113" r="15" fill="#412D15"/>
                  </svg>
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-white/75 font-medium tracking-wide">{statusMsg || 'Analysing plan…'}</p>
                <p className="text-[12px] text-white/35">Metricore is reading your construction documents</p>
              </div>
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.18}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {!isAnalysing && displayError && (
            <div className="flex flex-col items-center justify-center gap-4 h-full min-h-[400px] px-6">
              <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-800/30 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-sm text-white/70 font-medium">Analysis failed</p>
                <p className="text-[12px] text-white/35 mt-1">{displayError}</p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10"
                onClick={handleReanalyse}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          )}

          {/* No result yet — idle */}
          {!isAnalysing && !displayError && !result && (
            <div className="flex flex-col items-center justify-center gap-4 h-full min-h-[400px] px-6">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <ScanLine className="h-7 w-7 text-white/20" />
              </div>
              <div className="text-center max-w-sm">
                <p className="text-sm text-white/60 font-medium">Ready to analyse</p>
                <p className="text-[12px] text-white/30 mt-1">
                  {planId || pdfUrl
                    ? 'Analyse all pages of your plan to extract rooms, openings and trade quantities.'
                    : 'Upload a PDF plan to begin AI analysis.'}
                </p>
              </div>
              {(planId || pdfUrl) && (
                <Button
                  size="sm"
                  className="gap-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
                  onClick={handleAnalyse}
                >
                  <ScanLine className="h-4 w-4" />
                  Analyse Plan
                </Button>
              )}
            </div>
          )}

          {/* Results */}
          {!isAnalysing && !displayError && result && (
            <div className="p-5 space-y-5">

              {/* Stats row */}
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                <StatCard label="Floor Area" value={result.totalFloorArea > 0 ? `${result.totalFloorArea} m²` : '—'} />
                <StatCard label="Rooms" value={result.rooms.length} />
                {result.levels && result.levels > 0 && (
                  <StatCard label="Storeys" value={result.levels} />
                )}
                <StatCard
                  label="Doors"
                  value={result.openings.doors}
                  sub={result.openings.externalDoors != null
                    ? `${result.openings.externalDoors} ext · ${result.openings.internalDoors ?? result.openings.doors - (result.openings.externalDoors ?? 0)} int`
                    : undefined}
                />
                <StatCard label="Windows" value={result.openings.windows} />
                {result.estimatedTrades.length > 0 && (
                  <StatCard label="Trade Items" value={result.estimatedTrades.length} />
                )}
                {result.estimatedTrades.length > 0 && (() => {
                  const avg = Math.round(result.estimatedTrades.reduce((s, t) => s + t.confidence, 0) / result.estimatedTrades.length * 100);
                  const low = result.estimatedTrades.filter(t => t.confidence < 0.6).length;
                  return <StatCard label="Avg Confidence" value={`${avg}%`} sub={low > 0 ? `${low} low` : undefined} />;
                })()}
              </div>

              {/* Tab bar */}
              <div className="flex gap-1 border-b border-white/[0.07] pb-0">
                <button
                  onClick={() => setActiveTab('quantities')}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === 'quantities'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-white/40 hover:text-white/60'
                  }`}
                >
                  Estimated Quantities
                </button>
                <button
                  onClick={() => setActiveTab('elements')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === 'elements'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-white/40 hover:text-white/60'
                  }`}
                >
                  <Building2 className="h-3 w-3" />
                  Elements Found
                </button>
                <button
                  onClick={() => setActiveTab('scope')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === 'scope'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-white/40 hover:text-white/60'
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  Scope Report
                  {result.pendingItems && result.pendingItems.length > 0 && (
                    <span
                      className="ml-1 text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1 py-0.5"
                      title={`${result.pendingItems.length} items found on plan with no matching rate — add them manually in Scope Report`}
                    >
                      +{result.pendingItems.length}
                    </span>
                  )}
                </button>
              </div>

              {/* QUANTITIES TAB */}
              {activeTab === 'quantities' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

                  {/* Left: Rooms + Notes */}
                  <div className="lg:col-span-1 space-y-4">

                    {/* Rooms */}
                    {result.rooms.length > 0 && (
                      <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                          onClick={() => setRoomsOpen(v => !v)}
                        >
                          <div className="flex items-center gap-2">
                            <Home className="h-3.5 w-3.5 text-white/40" />
                            <span className="text-xs font-semibold text-white/70">Rooms</span>
                            <span className="text-[11px] text-white/30">{result.rooms.length}</span>
                          </div>
                          {roomsOpen ? <ChevronDown className="h-3.5 w-3.5 text-white/25" /> : <ChevronRight className="h-3.5 w-3.5 text-white/25" />}
                        </button>
                        {roomsOpen && (
                          <div className="divide-y divide-white/[0.04]">
                            {(() => {
                              const grouped = new Map<string, typeof result.rooms>();
                              for (const room of result.rooms) {
                                const lvl = room.level ?? 'Ground Floor';
                                if (!grouped.has(lvl)) grouped.set(lvl, []);
                                grouped.get(lvl)!.push(room);
                              }
                              const hasMultipleFloors = grouped.size > 1;
                              return [...grouped.entries()].flatMap(([level, rooms]) => [
                                ...(hasMultipleFloors ? [
                                  <div key={`hdr-${level}`} className="px-4 py-1 bg-white/[0.02] sticky top-0 z-10">
                                    <span className="text-[10px] font-semibold text-white/25 uppercase tracking-wider">{level}</span>
                                  </div>
                                ] : []),
                                ...rooms.map((room, i) => {
                                  const clean = cleanRoomName(room.name);
                                  return (
                                    <div key={`${level}-${i}`} className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02]">
                                      <span className="text-sm text-white/80">{clean}</span>
                                      {room.areaSqm > 0 ? (
                                        <span className="text-sm text-white/40 tabular-nums">{room.areaSqm} m²</span>
                                      ) : (
                                        <span className="text-[11px] text-white/20" title="Area included in another room's total">incl.</span>
                                      )}
                                    </div>
                                  );
                                }),
                              ]);
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Notes */}
                    {result.notes.length > 0 && (
                      <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                          onClick={() => setNotesOpen(v => !v)}
                        >
                          <span className="text-xs font-semibold text-white/70">AI Notes</span>
                          {notesOpen ? <ChevronDown className="h-3.5 w-3.5 text-white/25" /> : <ChevronRight className="h-3.5 w-3.5 text-white/25" />}
                        </button>
                        {notesOpen && (
                          <ul className="px-4 py-2 space-y-1.5">
                            {result.notes.map((n, i) => (
                              <li key={i} className="text-[12px] text-white/45 flex items-start gap-2">
                                <span className="text-cyan-500/60 mt-0.5">·</span>
                                <span>{n}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Trades grouped by category */}
                  {tradeGroups && tradeGroups.size > 0 && (
                    <div className="lg:col-span-2 space-y-2">
                      <div className="flex items-center justify-between px-1 mb-3">
                        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Trade Quantities</p>
                        <p className="text-[11px] text-white/25">
                          Expand a row for full spec · + to add to estimate
                        </p>
                      </div>
                      {[...tradeGroups.entries()].map(([cat, trades]) => (
                        <CategorySection
                          key={cat}
                          category={cat}
                          trades={trades}
                          pushedIds={pushedIds}
                          onPush={pushTrade}
                          onPushAll={pushCategory}
                          defaultOpen={true}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ELEMENTS FOUND TAB */}
              {activeTab === 'elements' && (
                <ModalElementsPanel elements={result.buildingElements} elementSources={result.elementSources} />
              )}

              {/* SCOPE REPORT TAB */}
              {activeTab === 'scope' && (
                <div className="space-y-4 max-w-4xl">

                  {/* Construction Overview */}
                  {result.constructionOverview && (
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-5 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-cyan-400" />
                        <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Construction Overview</span>
                      </div>
                      <p className="text-sm text-white/80 leading-relaxed">{result.constructionOverview}</p>
                    </div>
                  )}

                  {/* Scope Highlights */}
                  {result.scopeHighlights && result.scopeHighlights.length > 0 && (
                    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.05]">
                        <FileText className="h-3.5 w-3.5 text-white/50" />
                        <span className="text-xs font-semibold text-white/70">Scope of Works</span>
                        <span className="text-[10px] text-white/25 ml-auto">Key items for subcontractor briefing</span>
                      </div>
                      <ul className="divide-y divide-white/[0.04]">
                        {result.scopeHighlights.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                            <span className="text-cyan-500/50 font-mono text-[11px] mt-0.5 shrink-0 w-5 text-right">{i + 1}.</span>
                            <span className="text-[13px] text-white/75 leading-snug">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risk Items */}
                  {result.riskItems && result.riskItems.length > 0 && (
                    <div className="rounded-xl border border-amber-700/30 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-950/30 border-b border-amber-800/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-amber-300">Risk Items</span>
                        <span className="text-[10px] text-amber-500/50 ml-auto">Items needing clarification before tendering</span>
                      </div>
                      <ul className="divide-y divide-white/[0.04]">
                        {result.riskItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-amber-950/10">
                            <AlertTriangle className="h-3 w-3 text-amber-500/60 mt-0.5 shrink-0" />
                            <span className="text-[13px] text-white/70 leading-snug">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Assumptions */}
                  {result.assumptions && result.assumptions.length > 0 && (
                    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.05]">
                        <Info className="h-3.5 w-3.5 text-white/40" />
                        <span className="text-xs font-semibold text-white/60">Assumptions</span>
                        <span className="text-[10px] text-white/25 ml-auto">Underpins the quantities above</span>
                      </div>
                      <ul className="divide-y divide-white/[0.04]">
                        {result.assumptions.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                            <span className="text-white/20 mt-0.5 shrink-0">·</span>
                            <span className="text-[13px] text-white/55 leading-snug">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* NCC Summary — trades that have nccRef */}
                  {result.estimatedTrades.some(t => t.nccRef) && (
                    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.05]">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-400/70" />
                        <span className="text-xs font-semibold text-white/60">NCC 2022 References</span>
                        <span className="text-[10px] text-white/25 ml-auto">Compliance checkpoints per trade</span>
                      </div>
                      <div className="divide-y divide-white/[0.04]">
                        {result.estimatedTrades.filter(t => t.nccRef).map((t, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02]">
                            <span className="text-[13px] text-white/70">{t.trade}</span>
                            <span className="text-[11px] text-amber-400/60 font-mono">{t.nccRef}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending Items — no matching rate ID */}
                  {result.pendingItems && result.pendingItems.length > 0 && (
                    <div className="rounded-xl border border-amber-700/40 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-950/40 border-b border-amber-800/30">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-amber-300">Items Without a Rate</span>
                        <span className="text-[10px] text-amber-500/60 ml-auto">Visible on plans — add rates to include in estimate</span>
                      </div>
                      <div className="divide-y divide-white/[0.04]">
                        {result.pendingItems.map((item, i) => (
                          <div key={i} className="px-4 py-3 hover:bg-amber-950/10 space-y-0.5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[13px] text-white/80 font-medium">{item.description}</p>
                              <span className="text-[12px] text-white/40 tabular-nums shrink-0">{item.estimatedQuantity > 0 ? `${item.estimatedQuantity} ${item.unit}` : item.unit}</span>
                            </div>
                            <p className="text-[11px] text-amber-400/70 leading-snug">{item.reason}</p>
                          </div>
                        ))}
                      </div>
                      <div className="px-4 py-2.5 bg-amber-950/20 border-t border-amber-800/20">
                        <p className="text-[11px] text-amber-400/50">
                          These items need a custom rate added to the rate database before they can be pushed to the estimate.
                        </p>
                      </div>
                    </div>
                  )}

                  {!result.constructionOverview && (!result.scopeHighlights || result.scopeHighlights.length === 0) && (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                      <FileText className="h-8 w-8 text-white/10" />
                      <p className="text-sm text-white/30">Scope report not available for this analysis.</p>
                      <p className="text-[12px] text-white/20">Re-analyse the plan to generate a full scope report.</p>
                      <button
                        className="mt-1 text-xs text-cyan-400/60 hover:text-cyan-400 transition-colors"
                        onClick={handleReanalyse}
                      >
                        Re-analyse now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
