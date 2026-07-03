import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ScanLine, Loader2, Plus, CheckCheck, RefreshCw,
  Layers, ChevronDown, ChevronRight, ArrowUpRight,
  Home, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAIPlanAnalysis, AnalysisTrade, AnalysisResult } from '@/hooks/useAIPlanAnalysis';
import { CostItem } from '@/lib/takeoff/types';
import { getCachedPDF, cachePDF } from '@/lib/takeoff/pdfCache';
import { extractAnalysisPages } from '@/lib/takeoff/pdfPageExtractor';
import { buildCostItemsFromTrades } from '@/lib/takeoff/rateResolver';
import type { AustralianState } from '@/data/scopeOfWorkRates';

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

// ── Persistence helpers ───────────────────────────────────────────────────────

function analysisStorageKey(projectId: string) { return `planAnalysis_${projectId}`; }

function loadAnalysisCache(projectId: string): { result: AnalysisResult; timestamp: number } | null {
  try {
    const raw = localStorage.getItem(analysisStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.result?.rooms || !Array.isArray(parsed.result.estimatedTrades)) {
      localStorage.removeItem(analysisStorageKey(projectId));
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveAnalysisCache(projectId: string, result: AnalysisResult) {
  try { localStorage.setItem(analysisStorageKey(projectId), JSON.stringify({ result, timestamp: Date.now() })); }
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
  const col = CATEGORY_COLOUR[category] ?? CATEGORY_COLOUR['General'];
  const allPushed = trades.every(t => pushedIds.has(t.trade + t.quantity + t.unit));

  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
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
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/90 truncate">{t.trade}</p>
                  {t.notes && <p className="text-[11px] text-white/35 truncate mt-0.5">{t.notes}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-white/60 tabular-nums">{t.quantity} {t.unit}</span>
                  <span className={`text-[11px] font-medium ${confidenceColour(t.confidence)}`}>
                    {Math.round(t.confidence * 100)}%
                  </span>
                  <button
                    onClick={() => onPush(t)}
                    disabled={pushed}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                      pushed
                        ? 'border-emerald-500/40 text-emerald-400 cursor-default'
                        : 'border-white/10 text-white/30 hover:border-cyan-400/60 hover:text-cyan-400 group-hover:border-white/20 group-hover:text-white/60'
                    }`}
                    title={pushed ? 'Added to estimate' : 'Add to estimate'}
                  >
                    {pushed ? <CheckCheck className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
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
      const pages = await extractAnalysisPages(file, 12);
      setPageCount(pages.length);
      setStatusMsg(`Analysing ${pages.length} page${pages.length > 1 ? 's' : ''} with AI…`);
      const newResult = await analysePages(pages, { state, projectType: 'residential' });
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
      toast.error('Could not add item — check console for details');
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
      toast.error('Could not add items — check console for details');
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
      toast.error('Could not add items — check console for details');
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
    <div className="fixed inset-0 z-[10020] flex flex-col" role="dialog" aria-modal="true">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative z-10 flex flex-col w-full h-full max-w-7xl mx-auto my-0 md:my-6 md:h-[calc(100vh-48px)] bg-[#0D1117] md:rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] bg-[#0D1117]/90 backdrop-blur shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <ScanLine className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Plan Intelligence</h2>
              {pdfName && <p className="text-[11px] text-white/35 mt-0.5 truncate max-w-[240px]">{pdfName}</p>}
            </div>
            <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-950/60 text-amber-300 border-amber-700/50">Beta</Badge>
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
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors"
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
            <div className="flex flex-col items-center justify-center gap-4 h-full min-h-[400px]">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <ScanLine className="h-7 w-7 text-cyan-400" />
                </div>
                <Loader2 className="absolute -right-1 -bottom-1 h-5 w-5 text-cyan-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm text-white/70 font-medium">{statusMsg || 'Analysing plan…'}</p>
                <p className="text-[12px] text-white/30 mt-1">Claude is reading your construction documents</p>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
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
              </div>

              {/* Two-column layout */}
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
                          {result.rooms.map((room, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2 hover:bg-white/[0.02]">
                              <div>
                                <span className="text-sm text-white/80">{room.name}</span>
                                {room.level && (
                                  <span className="ml-2 text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">
                                    {room.level}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-white/40 tabular-nums">
                                {room.areaSqm > 0 ? `${room.areaSqm} m²` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Observations */}
                  {result.notes.length > 0 && (
                    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                        onClick={() => setNotesOpen(v => !v)}
                      >
                        <span className="text-xs font-semibold text-white/70">Observations</span>
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
                      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Estimated Quantities</p>
                      <p className="text-[11px] text-white/25">
                        Confidence shown per line · click + to add to estimate
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
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
