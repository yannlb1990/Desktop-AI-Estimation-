import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AnalysisRoom {
  name: string;
  areaSqm: number;
}

export interface AnalysisTrade {
  trade: string;
  quantity: number;
  unit: string;
  confidence: number;
}

export interface AnalysisResult {
  rooms: AnalysisRoom[];
  openings: { doors: number; windows: number };
  totalFloorArea: number;
  estimatedTrades: AnalysisTrade[];
  notes: string[];
}

export function useAIPlanAnalysis() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyse = async (imageBase64: string, projectContext?: object): Promise<AnalysisResult | null> => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyse-plan', {
        body: { imageBase64, projectContext: projectContext ?? {} },
      });

      if (fnError) throw new Error(fnError.message);

      const text: string = data?.content?.[0]?.text ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('AI returned an unexpected response format');
      }
      const parsed: AnalysisResult = JSON.parse(match[0]);
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

  return { analyse, loading, result, error, reset, setResult };
}
