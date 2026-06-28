import React, { useState, useEffect } from 'react';
import { ScanLine, Loader2, ChevronDown, ChevronRight, Plus, Lock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAIPlanAnalysis, AnalysisTrade, AnalysisResult } from '@/hooks/useAIPlanAnalysis';
import { CostItem } from '@/lib/takeoff/types';
import { getSubscriptionStatus } from '@/lib/subscription';

interface AIPlanAnalysisPanelProps {
  canvasElementRef: React.RefObject<HTMLCanvasElement | null>;
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
    // Validate shape so stale/malformed cache doesn't crash the panel
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
  } catch { /* storage full — ignore */ }
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
  projectId,
  projectState,
  onAddCostItems,
  isCalibrated,
}: AIPlanAnalysisPanelProps) {
  const { analyse, loading, result, error, reset, setResult } = useAIPlanAnalysis();
  const [expanded, setExpanded] = useState(true);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const { caps, isTrialing, effectivePlan } = getSubscriptionStatus();
  const locked = !caps.planAnalysis;

  // Load from cache on mount
  useEffect(() => {
    if (!projectId || locked) return;
    const cached = loadCached(projectId);
    if (cached) {
      setResult(cached.result);
      setCachedAt(cached.timestamp);
    }
  }, [projectId, locked]);

  // Save to cache whenever result changes
  useEffect(() => {
    if (!projectId || !result || cachedAt !== null) return;
    saveCache(projectId, result);
    setCachedAt(Date.now());
  }, [result, projectId]);

  const handleAnalyse = async () => {
    const canvas = canvasElementRef.current;
    if (!canvas) return;
    if (projectId) clearCache(projectId);
    setCachedAt(null);
    const imageBase64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    const newResult = await analyse(imageBase64, { state: projectState ?? 'QLD', projectType: 'residential' });
    if (newResult && projectId) {
      saveCache(projectId, newResult);
      setCachedAt(Date.now());
    }
  };

  const handleReanalyse = () => {
    if (projectId) clearCache(projectId);
    setCachedAt(null);
    reset();
  };

  const pushTrade = (trade: AnalysisTrade) => {
    if (!onAddCostItems) return;
    onAddCostItems([{
      id: crypto.randomUUID(),
      trade: trade.trade,
      description: `${trade.trade} (estimated — ${Math.round(trade.confidence * 100)}% confidence)`,
      quantity: trade.quantity,
      unit: trade.unit,
      rate: 0,
      total: 0,
    }]);
  };

  const pushAll = () => {
    if (!onAddCostItems || !result) return;
    onAddCostItems(
      result.estimatedTrades.map((t) => ({
        id: crypto.randomUUID(),
        trade: t.trade,
        description: `${t.trade} (estimated — ${Math.round(t.confidence * 100)}% confidence)`,
        quantity: t.quantity,
        unit: t.unit,
        rate: 0,
        total: 0,
      }))
    );
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
                Capture the current page and let Metricore estimate rooms, openings, and trade quantities from the plan image.
              </p>
              {!isCalibrated && (
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
                Analyse Current Page
              </Button>
            </div>
          )}

          {!locked && loading && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-6 w-6 text-foreground/50 animate-spin" />
              <p className="text-xs text-muted-foreground">Analysing plan…</p>
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
                </div>
                <div className="bg-muted/40 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground">Windows</p>
                  <p className="text-sm font-semibold">{result.openings.windows}</p>
                </div>
              </div>

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
                    <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto pr-1">
                      {result.rooms.map((room, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-foreground">{room.name}</span>
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
                        Push All
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {result.estimatedTrades.map((t, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-border/40 last:border-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {confidenceBadge(t.confidence)}
                          <span className="text-xs truncate">{t.trade}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">{t.quantity} {t.unit}</span>
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
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                  <ul className="space-y-0.5">
                    {result.notes.map((n, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {n}</li>
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
