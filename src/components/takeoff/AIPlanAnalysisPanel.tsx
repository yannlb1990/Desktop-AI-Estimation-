import React, { useState, useEffect } from 'react';
import { ScanLine, ChevronDown, ChevronRight, Plus, CheckCheck, Lock, Clock, Layers, Home, Thermometer, TreePine, Droplets, Building2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAIPlanAnalysis, AnalysisTrade, AnalysisResult, BuildingElements, PendingItem } from '@/hooks/useAIPlanAnalysis';
import { CostItem } from '@/lib/takeoff/types';
import { getSubscriptionStatus } from '@/lib/subscription';
import { getCachedPDF } from '@/lib/takeoff/pdfCache';
import { extractAnalysisPages } from '@/lib/takeoff/pdfPageExtractor';
import { buildCostItemsFromTrades } from '@/lib/takeoff/rateResolver';
import type { AustralianState } from '@/data/scopeOfWorkRates';

interface AIPlanAnalysisPanelProps {
  canvasElementRef?: React.RefObject<HTMLCanvasElement | null>;
  planId?: string;
  projectId?: string;
  projectState?: string;
  onAddCostItems?: (items: Partial<CostItem>[]) => void;
  isCalibrated?: boolean;
}

// Bump when the AI output schema gains new fields — old caches without those
// fields get auto-cleared so users always see full materialSpec/nccRef/elements detail.
const ANALYSIS_CACHE_VERSION = 2;

interface CachedAnalysis {
  result: AnalysisResult;
  timestamp: number;
  version?: number;
}

function cacheKey(projectId: string) {
  return `planAnalysis_${projectId}`;
}

function loadCached(projectId: string): CachedAnalysis | null {
  try {
    const raw = localStorage.getItem(cacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAnalysis;
    if ((parsed.version ?? 1) < ANALYSIS_CACHE_VERSION) {
      localStorage.removeItem(cacheKey(projectId));
      return null;
    }
    if (
      !parsed?.result?.rooms ||
      !parsed?.result?.openings ||
      !Array.isArray(parsed.result.estimatedTrades) ||
      !Array.isArray(parsed.result.notes)
    ) {
      localStorage.removeItem(cacheKey(projectId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(projectId: string, result: AnalysisResult) {
  try {
    localStorage.setItem(cacheKey(projectId), JSON.stringify({ result, timestamp: Date.now(), version: ANALYSIS_CACHE_VERSION }));
  } catch { /* storage full */ }
}

function clearCache(projectId: string) {
  localStorage.removeItem(cacheKey(projectId));
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STRUCTURE_LABELS: Record<string, string> = {
  timber_frame: 'Timber Frame', steel_frame: 'Steel Frame',
  brick_veneer: 'Brick Veneer', double_brick: 'Double Brick', unknown: 'Undetected',
};
const ROOF_LABELS: Record<string, string> = {
  hip: 'Hip', gable: 'Gable', skillion: 'Skillion', flat: 'Flat',
  dutch_gable: 'Dutch Gable', unknown: 'Undetected',
};
const COVER_LABELS: Record<string, string> = {
  colorbond: 'Colorbond', concrete_tile: 'Concrete Tile', terracotta: 'Terracotta',
  zincalume: 'Zincalume', unknown: 'Undetected',
};
const CLAD_LABELS: Record<string, string> = {
  brick_veneer: 'Brick Veneer', weatherboard: 'Weatherboard',
  fc_sheet: 'FC Sheet', render: 'Render', unknown: 'Undetected',
};
const FOUND_LABELS: Record<string, string> = {
  slab_on_ground: 'Slab on Ground', suspended_floor: 'Suspended Floor',
  pier_and_beam: 'Pier & Beam', unknown: 'Undetected',
};

function ElementsPanel({ elements }: { elements?: BuildingElements }) {
  if (!elements) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No element data. Re-analyse the plan to detect building elements.
      </p>
    );
  }
  const row = (label: string, value: string | number | undefined, sub?: string) =>
    value !== undefined ? (
      <div className="flex justify-between items-start py-1 border-b border-border/20 last:border-0">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <div className="text-right">
          <span className="text-[11px] font-medium">{value}</span>
          {sub && <span className="text-[10px] text-muted-foreground block">{sub}</span>}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
      {/* Structure */}
      <div className="rounded-md border border-border/30 p-2.5 space-y-0.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Home className="h-3 w-3 text-cyan-400" />
          <span className="text-[11px] font-semibold text-cyan-400">Structure</span>
        </div>
        {row('Frame type', elements.structureType ? STRUCTURE_LABELS[elements.structureType] : undefined)}
        {row('External cladding', elements.externalCladding ? CLAD_LABELS[elements.externalCladding] : undefined)}
        {row('Foundation', elements.foundationType ? FOUND_LABELS[elements.foundationType] : undefined)}
        {row('Wall height', elements.wallHeight ? `${elements.wallHeight} m` : undefined)}
      </div>

      {/* Framing spec */}
      <div className="rounded-md border border-border/30 p-2.5 space-y-0.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TreePine className="h-3 w-3 text-amber-400" />
          <span className="text-[11px] font-semibold text-amber-400">Framing Spec</span>
          <span className="text-[9px] text-muted-foreground ml-auto">NCC Vol 2 H1.3 · AS 1684</span>
        </div>
        {row('Stud size', elements.studSize)}
        {row('Timber grade', elements.timberGrade)}
        {row('Stud spacing', elements.studSpacing ? `${elements.studSpacing}mm c/c` : undefined,
          elements.studSpacing === 450 ? 'Upper floor / high load' : 'Standard residential')}
      </div>

      {/* Insulation / NCC */}
      <div className="rounded-md border border-border/30 p-2.5 space-y-0.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Thermometer className="h-3 w-3 text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-400">NCC Insulation</span>
          <span className="text-[9px] text-muted-foreground ml-auto">NCC Vol 2 H6.3</span>
        </div>
        {elements.climateZone !== undefined && row('Climate zone', `Zone ${elements.climateZone}`)}
        {row('Ceiling R-value', elements.ceilingRValue ? `R${elements.ceilingRValue}` : undefined, 'Minimum required')}
        {row('Wall R-value', elements.wallRValue ? `R${elements.wallRValue}` : undefined, 'Minimum required')}
      </div>

      {/* Roof */}
      <div className="rounded-md border border-border/30 p-2.5 space-y-0.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Building2 className="h-3 w-3 text-violet-400" />
          <span className="text-[11px] font-semibold text-violet-400">Roof</span>
        </div>
        {row('Roof type', elements.roofType ? ROOF_LABELS[elements.roofType] : undefined)}
        {row('Cover material', elements.roofCover ? COVER_LABELS[elements.roofCover] : undefined)}
        {row('Pitch', elements.roofPitch !== undefined ? `${elements.roofPitch}°` : undefined)}
      </div>

      {/* Wet areas */}
      {elements.wetAreas && elements.wetAreas.length > 0 && (
        <div className="rounded-md border border-border/30 p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Droplets className="h-3 w-3 text-blue-400" />
            <span className="text-[11px] font-semibold text-blue-400">Wet Areas</span>
            <span className="text-[9px] text-muted-foreground ml-auto">NCC F2.2 · AS 3740</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {elements.wetAreas.map((area, i) => (
              <span key={i} className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-700/40 rounded px-1.5 py-0.5">
                {area}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ObservationsDropdown({ notes }: { notes: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left"
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>Observations ({notes.length})</span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-3">
          {notes.map((n, i) => (
            <li key={i} className="text-xs text-muted-foreground leading-snug">· {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingItemsDropdown({ items }: { items: PendingItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="flex items-center gap-1 text-xs font-medium text-amber-400/80 hover:text-amber-400 w-full text-left"
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Clock className="h-3 w-3" />
        <span>Without Rate ({items.length})</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 pl-3">
          {items.map((item, i) => (
            <div key={i} className="text-xs space-y-0.5">
              <p className="text-foreground/80 font-medium">
                {item.description}
                {item.estimatedQuantity > 0 && (
                  <span className="ml-1 text-muted-foreground font-normal">{item.estimatedQuantity} {item.unit}</span>
                )}
              </p>
              <p className="text-amber-400/60 leading-snug text-[10px]">{item.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.8) {
    return <Badge className="text-[10px] px-1.5 py-0.5 bg-[#E1DCC9]/10 text-[#E1DCC9] border border-[#E1DCC9]/25">High</Badge>;
  }
  if (confidence >= 0.6) {
    return <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-900/40 text-amber-400 border border-amber-700/50">Mid</Badge>;
  }
  return <Badge className="text-[10px] px-1.5 py-0.5 bg-red-900/40 text-red-400 border border-red-700/50">Low</Badge>;
}

const PROJECT_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  residential:  { label: 'Residential',  className: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50' },
  commercial:   { label: 'Commercial',   className: 'bg-blue-900/40 text-blue-300 border-blue-700/50' },
  industrial:   { label: 'Industrial',   className: 'bg-orange-900/40 text-orange-300 border-orange-700/50' },
  mixed_use:    { label: 'Mixed Use',    className: 'bg-violet-900/40 text-violet-300 border-violet-700/50' },
};

export function AIPlanAnalysisPanel({
  canvasElementRef,
  planId,
  projectId,
  projectState,
  onAddCostItems,
  isCalibrated,
}: AIPlanAnalysisPanelProps) {
  const { analysePages, analyse, loading, result, error, reset, setResult } = useAIPlanAnalysis();
  const [expanded, setExpanded] = useState(true);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [pushedIds, setPushedIds] = useState<Set<string>>(new Set());
  const [expandedTrades, setExpandedTrades] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'quantities' | 'elements'>('quantities');
  const [isScannedPlan, setIsScannedPlan] = useState(false);
  const { caps, isTrialing, effectivePlan } = getSubscriptionStatus();
  const locked = !caps.planAnalysis;
  const state = (projectState as AustralianState) ?? 'QLD';

  useEffect(() => {
    if (!projectId || locked) return;
    const cached = loadCached(projectId);
    if (cached) {
      setResult(cached.result);
      setCachedAt(cached.timestamp);
    }
  }, [projectId, locked]);

  useEffect(() => {
    if (!projectId || !result || cachedAt !== null) return;
    if (projectId) saveCache(projectId, result);
    setCachedAt(Date.now());
  }, [result, projectId]);

  const handleAnalyse = async () => {
    if (projectId) clearCache(projectId);
    setCachedAt(null);
    setStatusMsg('');

    // Multi-page path: use planId to get the full PDF and extract all pages
    if (planId) {
      try {
        setStatusMsg('Loading PDF…');
        const cached = await getCachedPDF(planId);
        if (!cached) throw new Error('PDF not found in cache. Please reload the plan.');
        const file = new File([cached.data], cached.name, { type: 'application/pdf' });
        setStatusMsg(`Rendering pages…`);
        const { pages, isScanned } = await extractAnalysisPages(file, 12);
        setPageCount(pages.length);
        setIsScannedPlan(isScanned);
        setStatusMsg(`Analysing ${pages.length} page${pages.length > 1 ? 's' : ''}…`);
        const newResult = await analysePages(pages, { state, projectType: 'residential' }, undefined, isScanned);
        if (newResult && projectId) {
          saveCache(projectId, newResult);
          setCachedAt(Date.now());
        }
      } catch (err) {
        setStatusMsg('');
        // Error is set by the hook; nothing more to do here
        console.error('[AIPlanAnalysisPanel]', err);
      }
      setStatusMsg('');
      return;
    }

    // Fallback: capture current canvas if no planId available
    const canvas = canvasElementRef?.current;
    if (!canvas) return;
    setStatusMsg('Analysing current page…');
    const imageBase64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    const newResult = await analyse(imageBase64, { state, projectType: 'residential' });
    if (newResult && projectId) {
      saveCache(projectId, newResult);
      setCachedAt(Date.now());
    }
    setStatusMsg('');
  };

  const handleReanalyse = () => {
    if (projectId) clearCache(projectId);
    setCachedAt(null);
    setPageCount(null);
    setStatusMsg('');
    setPushedIds(new Set());
    reset();
  };

  const tradeKey = (t: AnalysisTrade) => `${t.trade}|${t.quantity}|${t.unit}`;

  const pushTrade = (trade: AnalysisTrade) => {
    if (!onAddCostItems) return;
    try {
      const items = buildCostItemsFromTrades([trade], state);
      onAddCostItems(items);
      setPushedIds(prev => new Set([...prev, tradeKey(trade)]));
      toast.success(`${trade.trade} added to estimate`, { duration: 2000 });
    } catch (err) {
      toast.error('Could not add item. Check the console for details.');
      console.error('[AIPlanAnalysisPanel] pushTrade error:', err);
    }
  };

  const pushAll = () => {
    if (!onAddCostItems || !result) return;
    try {
      const items = buildCostItemsFromTrades(result.estimatedTrades, state);
      onAddCostItems(items);
      const allKeys = new Set(result.estimatedTrades.map(tradeKey));
      setPushedIds(allKeys);
      toast.success(`${result.estimatedTrades.length} items added to estimate`, { duration: 2000 });
    } catch (err) {
      toast.error('Could not add items. Check the console for details.');
      console.error('[AIPlanAnalysisPanel] pushAll error:', err);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-[5px] overflow-hidden flex-shrink-0">
            <svg viewBox="-11.25 -52.5 235 235" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="-11.25" y="-52.5" width="235" height="235" rx="44" fill="#1F150C"/>
              <path d="M 18,110 L 18,65 C 18,10 72,10 72,65 C 72,120 126,120 126,65 C 126,10 180,10 180,65 L 180,110"
                stroke="#E1DCC9" strokeWidth="35" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="197" cy="113" r="15" fill="#412D15"/>
            </svg>
          </div>
          <span className="font-semibold text-sm">Plan Intelligence</span>
          <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-900/40 text-amber-300 border border-amber-700/50">Beta</Badge>
          {pageCount && pageCount > 1 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Layers className="h-2.5 w-2.5" />
              {pageCount}p
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cachedAt && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(cachedAt)}
            </span>
          )}
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3">
          {locked && (
            <div className="flex flex-col items-center gap-2.5 py-4 px-2 text-center rounded-md bg-muted/20 border border-border/40">
              <Lock className="h-5 w-5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                Plan Intelligence is available on <span className="text-foreground font-medium">Pro</span> and <span className="text-foreground font-medium">Business</span> plans.
              </p>
              {isTrialing && (
                <p className="text-[11px] text-muted-foreground/70">
                  Your {effectivePlan} trial does not include this feature.
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => window.location.href = '/pricing'}
              >
                Upgrade to unlock
              </Button>
            </div>
          )}

          {!locked && !result && !loading && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {planId
                  ? 'Analyse all pages of the uploaded plan to extract rooms, openings, and trade quantities.'
                  : 'Capture the current page and let Metricore estimate rooms, openings, and trade quantities.'}
              </p>
              {!isCalibrated && !planId && (
                <p className="text-[11px] text-amber-400">
                  Tip: calibrate the plan first for better area estimates.
                </p>
              )}
              <Button
                size="sm"
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleAnalyse}
                disabled={loading}
              >
                <ScanLine className="h-3.5 w-3.5" />
                {planId ? 'Analyse Full Plan' : 'Analyse Current Page'}
              </Button>
            </div>
          )}

          {!locked && loading && (
            <div className="flex flex-col items-center gap-3 py-5">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-16 h-16 rounded-2xl border border-cyan-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute w-14 h-14 rounded-2xl border border-cyan-400/10" />
                <div className="relative w-10 h-10 rounded-xl overflow-hidden" style={{ boxShadow: '0 0 20px rgba(34,211,238,0.12)' }}>
                  <svg viewBox="-11.25 -52.5 235 235" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="-11.25" y="-52.5" width="235" height="235" rx="44" fill="#1F150C"/>
                    <path d="M 18,110 L 18,65 C 18,10 72,10 72,65 C 72,120 126,120 126,65 C 126,10 180,10 180,65 L 180,110"
                      stroke="#E1DCC9" strokeWidth="35" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="197" cy="113" r="15" fill="#412D15"/>
                  </svg>
                </div>
              </div>
              <div className="text-center space-y-0.5">
                <p className="text-xs text-white/75 font-medium">{statusMsg || 'Analysing plan…'}</p>
                <p className="text-[11px] text-white/35">Metricore is reading your plans</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
            </div>
          )}

          {!locked && error && (
            <div className="space-y-2">
              <p className="text-xs text-red-400">{error}</p>
              <Button size="sm" variant="outline" onClick={handleReanalyse} className="w-full">
                Try Again
              </Button>
            </div>
          )}

          {!locked && result && (
            <div className="space-y-3">
              {/* Scanned plan notice */}
              {isScannedPlan && (
                <div className="flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-400/5 px-2.5 py-2">
                  <Info className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Scanned plan detected. AI analysis will use visual recognition only.
                  </p>
                </div>
              )}

              {/* Project type + construction overview */}
              {(result.projectType || result.constructionOverview) && (
                <div className="rounded-md bg-muted/20 border border-border/20 px-2.5 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {result.projectType && PROJECT_TYPE_CONFIG[result.projectType] && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${PROJECT_TYPE_CONFIG[result.projectType].className}`}>
                        {PROJECT_TYPE_CONFIG[result.projectType].label}
                      </span>
                    )}
                    {result.levels && result.levels > 1 && (
                      <span className="text-[9px] text-muted-foreground">{result.levels} storeys</span>
                    )}
                    {result.buildingElements?.structureType && result.buildingElements.structureType !== 'unknown' && (
                      <span className="text-[9px] text-muted-foreground">{STRUCTURE_LABELS[result.buildingElements.structureType]}</span>
                    )}
                  </div>
                  {result.constructionOverview && (
                    <p className="text-[11px] text-muted-foreground/80 leading-snug">{result.constructionOverview}</p>
                  )}
                </div>
              )}

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="bg-muted/40 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">Floor Area</p>
                  <p className="text-sm font-semibold">{result.totalFloorArea > 0 ? result.totalFloorArea : '—'}</p>
                  {result.totalFloorArea > 0 && <p className="text-[9px] text-muted-foreground">m²</p>}
                </div>
                <div className="bg-muted/40 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">Doors</p>
                  <p className="text-sm font-semibold">{result.openings.doors}</p>
                  {result.openings.externalDoors != null && (
                    <p className="text-[9px] text-muted-foreground">{result.openings.externalDoors}e · {result.openings.internalDoors ?? result.openings.doors - result.openings.externalDoors}i</p>
                  )}
                </div>
                <div className="bg-muted/40 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">Windows</p>
                  <p className="text-sm font-semibold">{result.openings.windows}</p>
                </div>
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-border/40">
                <button
                  onClick={() => setActiveTab('quantities')}
                  className={`flex-1 text-[11px] py-1.5 font-medium transition-colors ${
                    activeTab === 'quantities'
                      ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Quantities
                </button>
                <button
                  onClick={() => setActiveTab('elements')}
                  className={`flex-1 text-[11px] py-1.5 font-medium transition-colors ${
                    activeTab === 'elements'
                      ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Elements
                </button>
              </div>

              {/* QUANTITIES TAB */}
              {activeTab === 'quantities' && (
                <div className="space-y-2">
                  {/* Rooms collapsible */}
                  {result.rooms.length > 0 && (
                    <div>
                      <button
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => setRoomsOpen((v) => !v)}
                      >
                        {roomsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Rooms ({result.rooms.length})
                      </button>
                      {roomsOpen && (
                        <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto pr-1">
                          {result.rooms.map((room, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-foreground">
                                {room.name}
                                {room.level && <span className="text-muted-foreground ml-1 text-[10px]">({room.level})</span>}
                              </span>
                              <span className="text-muted-foreground">{room.areaSqm > 0 ? `${room.areaSqm} m²` : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Trade estimates */}
                  {result.estimatedTrades.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">Estimated Quantities</p>
                        {onAddCostItems && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={pushAll}>
                            Push All ({result.estimatedTrades.length})
                          </Button>
                        )}
                      </div>
                      <div className="space-y-0 max-h-72 overflow-y-auto pr-0.5">
                        {result.estimatedTrades.map((t, i) => {
                          const isExpanded = expandedTrades.has(i);
                          const pushed = pushedIds.has(tradeKey(t));
                          const hasDetails = !!(t.materialSpec || t.nccRef || t.notes);
                          return (
                            <div key={i} className="border-b border-border/30 last:border-0">
                              {/* Header row */}
                              <div
                                className={`flex items-center justify-between gap-2 py-1.5 ${hasDetails ? 'cursor-pointer hover:bg-muted/20' : ''} rounded-sm -mx-0.5 px-0.5`}
                                onClick={() => {
                                  if (!hasDetails) return;
                                  setExpandedTrades(prev => {
                                    const next = new Set(prev);
                                    if (next.has(i)) next.delete(i); else next.add(i);
                                    return next;
                                  });
                                }}
                              >
                                <div className="flex items-center gap-1 min-w-0 flex-1">
                                  {hasDetails ? (
                                    isExpanded
                                      ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                      : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  ) : <span className="w-3 shrink-0" />}
                                  {confidenceBadge(t.confidence)}
                                  <span className="text-xs truncate ml-0.5">{t.trade}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-xs text-muted-foreground tabular-nums">{t.quantity} {t.unit}</span>
                                  {onAddCostItems && (
                                    <button
                                      onClick={e => { e.stopPropagation(); pushTrade(t); }}
                                      disabled={pushed}
                                      className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${
                                        pushed
                                          ? 'text-emerald-400 cursor-default'
                                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                      }`}
                                      title={pushed ? 'Added to estimate' : 'Add to estimate'}
                                    >
                                      {pushed ? <CheckCheck className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Expanded detail panel */}
                              {isExpanded && (
                                <div className="ml-3 mb-2 rounded-md bg-muted/20 border border-border/20 px-2.5 py-2 space-y-1.5">
                                  {t.materialSpec && (
                                    <div>
                                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Material / Spec</p>
                                      <p className="text-[11px] text-cyan-400 leading-snug">{t.materialSpec}</p>
                                    </div>
                                  )}
                                  {t.nccRef && (
                                    <div>
                                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">NCC Reference</p>
                                      <p className="text-[11px] text-amber-400 leading-snug">{t.nccRef}</p>
                                    </div>
                                  )}
                                  {t.notes && (
                                    <div>
                                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Notes</p>
                                      <p className="text-[11px] text-muted-foreground leading-snug">{t.notes}</p>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between pt-0.5 border-t border-border/20">
                                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Confidence</span>
                                    <span className={`text-[11px] font-medium ${t.confidence >= 0.8 ? 'text-emerald-400' : t.confidence >= 0.6 ? 'text-amber-400' : 'text-red-400'}`}>
                                      {Math.round(t.confidence * 100)}%
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Observations */}
                  {result.notes.length > 0 && (
                    <ObservationsDropdown notes={result.notes} />
                  )}

                  {/* Pending items — no matching rate ID */}
                  {result.pendingItems && result.pendingItems.length > 0 && (
                    <PendingItemsDropdown items={result.pendingItems} />
                  )}
                </div>
              )}

              {/* ELEMENTS TAB */}
              {activeTab === 'elements' && (
                <ElementsPanel elements={result.buildingElements} />
              )}

              <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={handleReanalyse}>
                Clear & Re-analyse
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
