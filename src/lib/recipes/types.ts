// Recipes module — TypeScript interfaces mirroring Supabase table shapes

export type AssemblyStatus = 'draft' | 'published' | 'archived';
export type AssemblyType   = 'standard' | 'preliminaries';
export type ItemType       = 'material' | 'labour' | 'plant' | 'subcontract' | 'other';
export type RoundingRule   = 'none' | 'up_to_pack';

export interface TradeRecord {
  id: string;
  org_id: string | null;
  code: string;
  name: string;
  sort_order: number;
}

export interface ElementCategory {
  id: string;
  org_id: string | null;
  parent_id: string | null;
  code: string;
  name: string;
  default_uom: string;
  sort_order: number;
}

export interface CostItemLibrary {
  id: string;
  org_id: string | null;
  code: string;
  name: string;
  item_type: ItemType;
  uom: string;
  pack_size: number | null;
  default_trade_id: string | null;
  is_active: boolean;
}

export interface CostItemRate {
  id: string;
  cost_item_id: string;
  org_id: string | null;
  region_code: string;
  unit_rate: number;
  currency: string;
  supplier: string | null;
  effective_from: string;
  effective_to: string | null;
  source: string;
}

export interface Assembly {
  id: string;
  org_id: string | null;
  element_category_id: string;
  code: string;
  name: string;
  description: string | null;
  uom: string;
  assembly_type: AssemblyType;
  region_code: string;
  status: AssemblyStatus;
  version: number;
  cloned_from_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AssemblyComponent {
  id: string;
  assembly_id: string;
  cost_item_id: string;
  trade_id: string;
  qty_per_unit: number;
  waste_pct: number;
  rounding: RoundingRule;
  formula: string | null;
  side_count_applies: boolean;
  is_optional: boolean;
  notes: string | null;
  sort_order: number;
}

// Joined shape returned by getAssemblyWithComponents()
export interface AssemblyWithComponents {
  assembly: Assembly;
  components: AssemblyComponent[];
  costItems: Record<string, CostItemLibrary>;   // keyed by cost_item_id
  trades: Record<string, TradeRecord>;           // keyed by trade_id
  resolvedRates: Record<string, number>;         // keyed by cost_item_id
}

// Filters for listAssemblies()
export interface AssemblyFilters {
  categoryId?: string;
  tradeCode?: string;
  status?: AssemblyStatus;
  searchText?: string;
}
