import { supabase } from '@/integrations/supabase/client';
import type {
  Assembly,
  AssemblyComponent,
  AssemblyFilters,
  AssemblyWithComponents,
  CostItemLibrary,
  ElementCategory,
  TradeRecord,
} from './types';

// ── Trades ────────────────────────────────────────────────────────────────────

export async function listTrades(): Promise<TradeRecord[]> {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data as TradeRecord[];
}

// ── Element categories ────────────────────────────────────────────────────────

export async function listElementCategories(): Promise<ElementCategory[]> {
  const { data, error } = await supabase
    .from('element_categories')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data as ElementCategory[];
}

// ── Assemblies ────────────────────────────────────────────────────────────────

export async function listAssemblies(filters: AssemblyFilters = {}): Promise<Assembly[]> {
  let query = supabase
    .from('assemblies')
    .select('*')
    .eq('status', filters.status ?? 'published')
    .order('name');

  if (filters.categoryId) {
    query = query.eq('element_category_id', filters.categoryId);
  }

  if (filters.searchText) {
    query = query.ilike('name', `%${filters.searchText}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  let assemblies = data as Assembly[];

  // Trade filter — post-filter via assembly_trades view
  if (filters.tradeCode) {
    const { data: tradeRows, error: tradeError } = await supabase
      .from('assembly_trades')
      .select('assembly_id, trades!inner(code)')
      .eq('trades.code', filters.tradeCode);

    if (tradeError) throw tradeError;
    const matchIds = new Set((tradeRows ?? []).map((r: any) => r.assembly_id));
    assemblies = assemblies.filter(a => matchIds.has(a.id));
  }

  return assemblies;
}

// ── Full assembly with components and resolved rates ──────────────────────────

export async function getAssemblyWithComponents(
  assemblyId: string,
  region: string = 'AU-NAT',
): Promise<AssemblyWithComponents> {
  const [assemblyRes, componentsRes] = await Promise.all([
    supabase.from('assemblies').select('*').eq('id', assemblyId).single(),
    supabase.from('assembly_components').select('*').eq('assembly_id', assemblyId).order('sort_order'),
  ]);

  if (assemblyRes.error) throw assemblyRes.error;
  if (componentsRes.error) throw componentsRes.error;

  const assembly   = assemblyRes.data as Assembly;
  const components = componentsRes.data as AssemblyComponent[];
  const costItemIds = [...new Set(components.map(c => c.cost_item_id))];
  const tradeIds    = [...new Set(components.map(c => c.trade_id))];

  const [itemsRes, tradesRes] = await Promise.all([
    supabase.from('cost_items').select('*').in('id', costItemIds),
    supabase.from('trades').select('*').in('id', tradeIds),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (tradesRes.error) throw tradesRes.error;

  const costItems: Record<string, CostItemLibrary> = {};
  for (const item of (itemsRes.data as CostItemLibrary[])) {
    costItems[item.id] = item;
  }

  const trades: Record<string, TradeRecord> = {};
  for (const trade of (tradesRes.data as TradeRecord[])) {
    trades[trade.id] = trade;
  }

  const resolvedRates = await resolveRates(costItemIds, region);

  return { assembly, components, costItems, trades, resolvedRates };
}

// ── Rate resolution ───────────────────────────────────────────────────────────

export async function resolveRates(
  costItemIds: string[],
  region: string = 'AU-NAT',
): Promise<Record<string, number>> {
  if (costItemIds.length === 0) return {};

  const { data: { user } } = await supabase.auth.getUser();
  const orgId = user?.id ?? null;

  // Call resolve_rate() for each item — parallel RPC calls
  const results = await Promise.all(
    costItemIds.map(id =>
      supabase.rpc('resolve_rate', {
        p_cost_item_id: id,
        p_org_id:       orgId,
        p_region:       region,
      })
    )
  );

  const rates: Record<string, number> = {};
  costItemIds.forEach((id, idx) => {
    const rows = results[idx].data;
    if (rows && rows.length > 0) {
      rates[id] = Number(rows[0].unit_rate);
    }
  });

  return rates;
}
