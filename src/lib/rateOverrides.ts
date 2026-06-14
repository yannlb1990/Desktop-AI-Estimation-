import { supabase } from "@/integrations/supabase/client";
import { SOWRate, AustralianState } from "@/data/scopeOfWorkRates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function fetchRateOverrides(): Promise<Map<string, number>> {
  const { data, error } = await db
    .from('rate_overrides')
    .select('rate_id, state, value');

  if (error || !data) return new Map();

  const map = new Map<string, number>();
  for (const row of data) {
    map.set(`${row.rate_id}:${row.state}`, Number(row.value));
  }
  return map;
}

export function applyOverrides(rates: SOWRate[], overrides: Map<string, number>): SOWRate[] {
  if (overrides.size === 0) return rates;

  const states: AustralianState[] = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  return rates.map(rate => {
    const modified = { ...rate };
    for (const state of states) {
      const override = overrides.get(`${rate.id}:${state}`);
      if (override !== undefined) {
        (modified as Record<string, unknown>)[state] = override;
      }
    }
    return modified;
  });
}

export async function saveRateOverride(
  rate_id: string,
  state: AustralianState,
  value: number,
  notes?: string
): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  await db.from('rate_overrides').upsert({
    rate_id,
    state,
    value,
    updated_at: new Date().toISOString(),
    updated_by: authData?.user?.id ?? null,
    notes: notes ?? null,
  });
}

export async function deleteRateOverride(rate_id: string, state: AustralianState): Promise<void> {
  await db.from('rate_overrides')
    .delete()
    .eq('rate_id', rate_id)
    .eq('state', state);
}
