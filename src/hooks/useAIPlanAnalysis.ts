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
}

export interface AnalysisResult {
  rooms: AnalysisRoom[];
  openings: { doors: number; windows: number; externalDoors?: number; internalDoors?: number };
  totalFloorArea: number;
  levels?: number;
  estimatedTrades: AnalysisTrade[];
  notes: string[];
}

function parseResult(data: { result?: AnalysisResult; raw?: { content?: { type: string; text?: string }[] }; content?: { type: string; text?: string }[] }): AnalysisResult {
  // New path: edge function returns { result: {...} } from tool_use
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
      estimatedTrades: r.estimatedTrades ?? [],
      notes: r.notes ?? [],
    };
  }

  // Fallback: legacy path where edge returned raw Anthropic response
  const rawData = data?.raw ?? data;
  const text: string = rawData?.content?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI returned an unexpected response format');
  const parsed = JSON.parse(match[0]) as AnalysisResult;
  return parsed;
}

export function useAIPlanAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analysePages = async (
    pages: ExtractedPage[],
    projectContext?: object
  ): Promise<AnalysisResult | null> => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyse-plan', {
        body: {
          pages: pages.map((p) => ({
            pageIndex: p.pageIndex,
            imageBase64: p.imageBase64,
            mediaType: p.mediaType,
          })),
          projectContext: projectContext ?? {},
        },
      });
      if (fnError) throw new Error(fnError.message);
      const parsed = parseResult(data);
      setResult(parsed);
      return parsed;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
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
      if (fnError) throw new Error(fnError.message);
      const parsed = parseResult(data);
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
