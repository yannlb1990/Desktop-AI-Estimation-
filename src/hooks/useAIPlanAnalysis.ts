import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ExtractedPage } from '@/lib/takeoff/pdfPageExtractor';

export interface AnalysisRoom {
  name: string;
  areaSqm: number;
  level?: string;
}

export interface AnalysisTrade {
  trade: string;
  quantity: number;
  unit: string;
  confidence: number;
  rateId?: string;
  notes?: string;
  materialSpec?: string;
  nccRef?: string;
}

export interface BuildingElements {
  structureType?: 'timber_frame' | 'steel_frame' | 'brick_veneer' | 'double_brick' | 'unknown';
  wallHeight?: number;
  studSpacing?: 450 | 600;
  studSize?: string;
  timberGrade?: string;
  roofType?: 'hip' | 'gable' | 'skillion' | 'flat' | 'dutch_gable' | 'unknown';
  roofCover?: 'colorbond' | 'concrete_tile' | 'terracotta' | 'zincalume' | 'unknown';
  roofPitch?: number;
  foundationType?: 'slab_on_ground' | 'suspended_floor' | 'pier_and_beam' | 'unknown';
  climateZone?: number;
  ceilingRValue?: number;
  wallRValue?: number;
  externalCladding?: 'brick_veneer' | 'weatherboard' | 'fc_sheet' | 'render' | 'unknown';
  wetAreas?: string[];
}

export interface PendingItem {
  description: string;
  estimatedQuantity: number;
  unit: string;
  reason: string;
}

export interface ElementSource {
  field: string;      // matches a BuildingElements key e.g. 'studSpacing'
  pageIndex: number;  // 1-based page number
  excerpt: string;    // verbatim text from the drawing, max 120 chars
}

export interface AnalysisResult {
  rooms: AnalysisRoom[];
  openings: { doors: number; windows: number; externalDoors?: number; internalDoors?: number };
  totalFloorArea: number;
  levels?: number;
  estimatedTrades: AnalysisTrade[];
  notes: string[];
  constructionOverview?: string;
  scopeHighlights?: string[];
  riskItems?: string[];
  assumptions?: string[];
  buildingElements?: BuildingElements;
  elementSources?: ElementSource[];
  projectType?: 'residential' | 'commercial' | 'industrial' | 'mixed_use';
  pendingItems?: PendingItem[];
}

// Three focused passes run in parallel.
// Each pass sends ALL pages but extracts only one trade group.
// Output per pass: 4-12 trades → 20-40s each, well under 130s abort.
type FocusCategory = 'base' | 'interior' | 'services';

/**
 * Merge duplicate trade entries across passes.
 * Primary key: rateId. Fallback key: name|unit (case-insensitive).
 * First occurrence wins for quantities (base pass has authoritative measurements).
 */
function deduplicateTrades(trades: AnalysisTrade[]): AnalysisTrade[] {
  const byRateId = new Map<string, AnalysisTrade>();
  const byNameUnit = new Map<string, AnalysisTrade>();

  for (const t of trades) {
    if (t.rateId) {
      const existing = byRateId.get(t.rateId);
      if (existing) {
        byRateId.set(t.rateId, {
          ...existing,
          quantity: Math.round((existing.quantity + t.quantity) * 100) / 100,
          confidence: Math.max(existing.confidence, t.confidence),
          materialSpec: existing.materialSpec || t.materialSpec,
          nccRef: existing.nccRef || t.nccRef,
          notes: existing.notes && t.notes
            ? `${existing.notes}; ${t.notes}`
            : existing.notes || t.notes,
        });
      } else {
        byRateId.set(t.rateId, { ...t });
      }
    } else {
      const key = `${t.trade.toLowerCase().trim()}|${t.unit}`;
      const existing = byNameUnit.get(key);
      if (existing) {
        byNameUnit.set(key, {
          ...existing,
          quantity: Math.round((existing.quantity + t.quantity) * 100) / 100,
          confidence: Math.max(existing.confidence, t.confidence),
          materialSpec: existing.materialSpec || t.materialSpec,
          nccRef: existing.nccRef || t.nccRef,
          notes: existing.notes && t.notes
            ? `${existing.notes}; ${t.notes}`
            : existing.notes || t.notes,
        });
      } else {
        byNameUnit.set(key, { ...t });
      }
    }
  }

  return [...byRateId.values(), ...byNameUnit.values()];
}

/**
 * Merge 3 pass results into a single AnalysisResult.
 * - Base pass (index 0) is authoritative for spatial data.
 * - All passes contribute their estimatedTrades (deduped by rateId).
 * - pendingItems merged by description (case-insensitive).
 */
function mergePassResults(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 1) return results[0];

  // Merge all trades from all passes
  const allTrades = results.flatMap(r => r.estimatedTrades ?? []);
  const mergedTrades = deduplicateTrades(allTrades);

  // Rooms: union by name+level (only base pass populates this)
  const roomMap = new Map<string, AnalysisRoom>();
  for (const r of results) {
    for (const room of r.rooms ?? []) {
      const key = `${room.name.toLowerCase()}|${(room.level ?? '').toLowerCase()}`;
      if (!roomMap.has(key)) roomMap.set(key, room);
    }
  }

  // Openings: max per field (base pass has authoritative counts)
  const openings = {
    doors: Math.max(...results.map(r => r.openings?.doors ?? 0)),
    windows: Math.max(...results.map(r => r.openings?.windows ?? 0)),
    externalDoors: Math.max(...results.map(r => r.openings?.externalDoors ?? 0)),
    internalDoors: Math.max(...results.map(r => r.openings?.internalDoors ?? 0)),
  };

  const totalFloorArea = Math.max(...results.map(r => r.totalFloorArea ?? 0));
  const levels = Math.max(...results.map(r => r.levels ?? 1));

  const uniqueNotes = [...new Set(results.flatMap(r => r.notes ?? []))];
  const scopeHighlights = [...new Set(results.flatMap(r => r.scopeHighlights ?? []))].slice(0, 10);
  const riskItems = [...new Set(results.flatMap(r => r.riskItems ?? []))].slice(0, 8);
  const assumptions = [...new Set(results.flatMap(r => r.assumptions ?? []))].slice(0, 8);

  // Pending items: union by description (case-insensitive, deduplicated across all passes)
  const pendingMap = new Map<string, PendingItem>();
  for (const r of results) {
    for (const p of r.pendingItems ?? []) {
      const key = p.description.toLowerCase().trim();
      if (!pendingMap.has(key)) pendingMap.set(key, p);
    }
  }

  const primary = results[0];
  return {
    rooms: [...roomMap.values()],
    openings,
    totalFloorArea,
    levels,
    estimatedTrades: mergedTrades,
    notes: uniqueNotes,
    constructionOverview:
      primary.constructionOverview ??
      results.find(r => r.constructionOverview)?.constructionOverview,
    scopeHighlights,
    riskItems,
    assumptions,
    buildingElements: primary.buildingElements ?? results.find(r => r.buildingElements)?.buildingElements,
    elementSources: primary.elementSources ?? results.find(r => r.elementSources)?.elementSources,
    projectType: primary.projectType ?? results.find(r => r.projectType)?.projectType,
    pendingItems: pendingMap.size > 0 ? [...pendingMap.values()] : undefined,
  };
}

type RawBody =
  | { result?: AnalysisResult; raw?: { content?: { type: string; text?: string }[] }; content?: { type: string; text?: string }[] }
  | null
  | undefined;

function parseResult(data: RawBody): AnalysisResult {
  if (data?.result) {
    const r = data.result;
    return {
      rooms: r.rooms ?? [],
      openings: {
        doors: r.openings?.doors ?? 0,
        windows: r.openings?.windows ?? 0,
        externalDoors: r.openings?.externalDoors,
        internalDoors: r.openings?.internalDoors,
      },
      totalFloorArea: r.totalFloorArea ?? 0,
      levels: r.levels,
      estimatedTrades: deduplicateTrades(r.estimatedTrades ?? []),
      notes: r.notes ?? [],
      constructionOverview: r.constructionOverview,
      scopeHighlights: r.scopeHighlights ?? [],
      riskItems: r.riskItems ?? [],
      assumptions: r.assumptions ?? [],
      buildingElements: r.buildingElements,
      elementSources: r.elementSources,
      projectType: r.projectType,
      pendingItems: r.pendingItems,
    };
  }

  // Fallback: legacy raw Anthropic response
  const rawData = data?.raw ?? data;
  const text: string = (rawData as { content?: { type: string; text?: string }[] } | null | undefined)?.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI returned an unexpected response format');
  const parsed = JSON.parse(match[0]) as AnalysisResult;
  parsed.estimatedTrades = deduplicateTrades(parsed.estimatedTrades ?? []);
  return parsed;
}

// Parses a trades-only response (interior or services pass).
// Returns a partial AnalysisResult with empty spatial data.
function parseTradesResult(data: RawBody): AnalysisResult {
  const r = (data?.result ?? {}) as { estimatedTrades?: AnalysisTrade[]; pendingItems?: PendingItem[] };
  return {
    rooms: [],
    openings: { doors: 0, windows: 0, externalDoors: 0, internalDoors: 0 },
    totalFloorArea: 0,
    estimatedTrades: deduplicateTrades(r.estimatedTrades ?? []),
    notes: [],
    pendingItems: r.pendingItems,
  };
}

/** Extract the actual server error message from a Supabase functions error. */
async function extractServerMessage(fnError: unknown): Promise<string> {
  try {
    const ctx = (fnError as Record<string, unknown>)?.context as Response | undefined;
    if (ctx) {
      const text = await ctx.text().catch(() => null);
      if (text) {
        try {
          const body = JSON.parse(text) as { error?: string; message?: string };
          return body?.error ?? body?.message ?? text.slice(0, 400);
        } catch {
          return text.slice(0, 400);
        }
      }
    }
  } catch { /* ignore */ }

  const msg = (fnError as Error)?.message ?? '';
  console.error('[analyse-plan] raw error:', fnError);
  if (msg) return msg;
  return '';
}

/** Invoke one focused pass against the edge function. */
async function invokePass(
  pages: ExtractedPage[],
  focusCategory: FocusCategory,
  projectContext?: object,
  isScanned?: boolean
): Promise<AnalysisResult> {
  const { data, error: fnError } = await supabase.functions.invoke('analyse-plan', {
    body: {
      pages: pages.map(p => ({
        pageIndex: p.pageIndex,
        imageBase64: p.imageBase64,
        mediaType: p.mediaType,
      })),
      projectContext: projectContext ?? {},
      focusCategory,
      isScanned: isScanned ?? false,
    },
  });

  if (fnError) {
    const serverMsg = await extractServerMessage(fnError);
    if (
      serverMsg.toLowerCase().includes('upgrade') ||
      serverMsg.includes('403')
    ) {
      throw new Error('Plan upgrade required to use AI Plan Analyser.');
    }
    throw new Error(
      serverMsg ||
      `Edge function error: ${(fnError as Error)?.message ?? 'unknown'}. Check browser console for details.`
    );
  }

  if (focusCategory === 'base') {
    return parseResult(data as RawBody);
  }
  return parseTradesResult(data as RawBody);
}

export function useAIPlanAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Analyse all pages using 3 focused passes running in parallel.
   *
   * Pass 'base'     → spatial data + structure + framing + roof + external envelope
   * Pass 'interior' → openings + internal finishes + wet areas + cabinetry
   * Pass 'services' → electrical + plumbing + HVAC + fire + external works
   *
   * All 3 run simultaneously. Each pass outputs 4-12 trades (not 40+),
   * completing in 20-40s — well under the 130s edge function abort timeout.
   * Results are merged client-side.
   *
   * onProgress(completedPasses, totalPasses) is called after each pass lands.
   */
  const analysePages = async (
    allPages: ExtractedPage[],
    projectContext?: object,
    onProgress?: (done: number, total: number) => void,
    isScanned?: boolean
  ): Promise<AnalysisResult | null> => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let done = 0;
      const inc = () => { done++; onProgress?.(done, 3); };

      const [baseResult, interiorResult, servicesResult] = await Promise.all([
        invokePass(allPages, 'base', projectContext, isScanned).then(r => { inc(); return r; }),
        invokePass(allPages, 'interior', projectContext, isScanned).then(r => { inc(); return r; }),
        invokePass(allPages, 'services', projectContext, isScanned).then(r => { inc(); return r; }),
      ]);

      const merged = mergePassResults([baseResult, interiorResult, servicesResult]);
      setResult(merged);
      return merged;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Legacy single-image path (kept for any callers that still use it)
  const analyse = async (
    imageBase64: string,
    projectContext?: object
  ): Promise<AnalysisResult | null> => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyse-plan', {
        body: { imageBase64, projectContext: projectContext ?? {} },
      });
      if (fnError) {
        const serverMsg = await extractServerMessage(fnError);
        throw new Error(serverMsg || 'Analysis failed. Please try again.');
      }
      const parsed = parseResult(data as RawBody);
      setResult(parsed);
      return parsed;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { analyse, analysePages, loading, result, error, reset, setResult };
}
