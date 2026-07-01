import React, { useState, useEffect } from 'react';
import { ScanLine, Loader2, ChevronDown, ChevronRight, Plus, Lock, Clock, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAIPlanAnalysis, AnalysisTrade, AnalysisResult } from '@/hooks/useAIPlanAnalysis';
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

interface CachedAnalysis {
  result: AnalysisResult;
  timestamp: number;
}

function cacheKey(projectId: string) {
  return `planAnalysis_${projectId}`;
}

function loadCached(projectId: string): CachedAnalysis | null {
  try {
    const raw = localStorage.getItem(cacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAnalysis;
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
    localStorage.setItem(cacheKey(projectId), JSON.stringify({ result, timestamp: Date.now() }));
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

function confidenceBadge(confidence: number) {
  if (confidence >= 0.8) {
    return <Badge className="text-[10px] px-1.5 py-0.5 bg-[#E1DCC9]/10 text-[#E1DCC9] border border-[#E1DCC9]/25">High</Badge>;
  }
  if (confidence >= 0.6) {
    return <Badge className="text-[10px] px-1.5 py-0.5 bg-amber-900/40 text-amber-400 border border-amber-700/50">Mid</Badge>;
  }
  return <Badge className="text-[10px] px-1.5 py-0.5 bg-red-900/40 text-red-400 border border-red-700/50">Low</Badge>;
}

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
        const pages = await extractAnalysisPages(file, 12);
        setPageCount(pages.length);
        setStatusMsg(`Analysing ${pages.length} page${pages.length > 1 ? 's' : ''}…`);
        const newResult = await analysePages(pages, { state, projectType: 'residential' });
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
    reset();
  };

  const pushTrade = (trade: AnalysisTrade) => {
    if (!onAddCostItems) return;
    const items = buildCostItemsFromTrades([trade], state);
    onAddCostItems(items);
  };

  const pushAll = () => {
    if (!onAddCostItems || !result) return;
    const items = buildCostItemsFromTrades(result.estimatedTrades, state);
    onAddCostItems(items);
  };

  return (
    <Card className="p-4 space-y-3">
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ScanLine className="h-4 w-4 text-foreground/60" />
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
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-6 w-6 text-foreground/50 animate-spin" />
              <p className="text-xs text-muted-foreground">{statusMsg || 'Analysing plan…'}</p>
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
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/40 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">Floor Area</p>
                  <p className="text-sm font-semibold">{result.totalFloorArea > 0 ? `${result.totalFloorArea} m²` : '—'}</p>
                </div>
                <div className="bg-muted/40 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">Doors</p>
                  <p className="text-sm font-semibold">{result.openings.doors}</p>
                  {result.openings.externalDoors != null && (
                    <p className="text-[9px] text-muted-foreground">{result.openings.externalDoors} ext · {result.openings.internalDoors ?? result.openings.doors - result.openings.externalDoors} int</p>
                  )}
                </div>
                <div className="bg-muted/40 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">Windows</p>
                  <p className="text-sm font-semibold">{result.openings.windows}</p>
                </div>
              </div>

              {result.levels && result.levels > 1 && (
                <p className="text-[11px] text-muted-foreground text-center">
                  {result.levels}-storey building
                </p>
              )}

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
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
                    {result.estimatedTrades.map((t, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {confidenceBadge(t.confidence)}
                          <div className="min-w-0">
                            <span className="text-xs block truncate">{t.trade}</span>
                            {t.notes && <span className="text-[10px] text-muted-foreground truncate block">{t.notes}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">{t.quantity} {t.unit}</span>
                          </div>
                          {onAddCostItems && (
                            <button
                              onClick={() => pushTrade(t)}
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Add to estimate"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {result.notes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Observations</p>
                  <ul className="space-y-0.5">
                    {result.notes.map((n, i) => (
                      <li key={i} className="text-xs text-muted-foreground">· {n}</li>
                    ))}
                  </ul>
                </div>
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
