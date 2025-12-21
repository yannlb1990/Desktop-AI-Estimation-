// Market Insights API - Unified access to market data
// Provides real-time pricing, supplier info, and rate data

import { supabase } from '@/integrations/supabase/client';

// Australian state codes
export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'NT' | 'ACT';

// Types
export interface LabourRate {
  trade: string;
  state: AustralianState;
  hourlyRate: number;
  dayRate: number;
  unit: string;
  lastUpdated: string;
  source: string;
  notes?: string;
}

export interface SOWRate {
  trade: string;
  sowType: string;
  description: string;
  state: AustralianState;
  unit: string;
  minRate: number;
  maxRate: number;
  avgRate: number;
  lastUpdated: string;
  includesLabour: boolean;
  includesMaterials: boolean;
}

export interface MaterialPrice {
  id: string;
  productCode?: string;
  productName: string;
  brand?: string;
  category: string;
  supplier: string;
  state: AustralianState;
  unit: string;
  price: number;
  previousPrice?: number;
  priceUpdatedAt: string;
  inStock: boolean;
  leadTimeDays?: number;
}

export interface SupplierInfo {
  id: string;
  name: string;
  state: AustralianState;
  category: string;
  phone: string;
  email: string;
  website?: string;
  rating: number;
  isPreferred: boolean;
}

export interface PriceWebhook {
  id: string;
  supplierId: string;
  webhookUrl: string;
  apiKey?: string;
  categories: string[];
  isActive: boolean;
  lastSyncAt?: string;
  syncFrequency: 'hourly' | 'daily' | 'weekly';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Default labour rates by state (AUD per hour, 2024 rates)
export const DEFAULT_LABOUR_RATES: LabourRate[] = [
  // NSW
  { trade: 'Carpenter', state: 'NSW', hourlyRate: 85, dayRate: 680, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plumber', state: 'NSW', hourlyRate: 95, dayRate: 760, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Electrician', state: 'NSW', hourlyRate: 95, dayRate: 760, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Tiler', state: 'NSW', hourlyRate: 80, dayRate: 640, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Painter', state: 'NSW', hourlyRate: 70, dayRate: 560, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plasterer', state: 'NSW', hourlyRate: 75, dayRate: 600, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Concreter', state: 'NSW', hourlyRate: 80, dayRate: 640, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Labourer', state: 'NSW', hourlyRate: 55, dayRate: 440, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },

  // VIC
  { trade: 'Carpenter', state: 'VIC', hourlyRate: 82, dayRate: 656, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plumber', state: 'VIC', hourlyRate: 92, dayRate: 736, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Electrician', state: 'VIC', hourlyRate: 92, dayRate: 736, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Tiler', state: 'VIC', hourlyRate: 78, dayRate: 624, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Painter', state: 'VIC', hourlyRate: 68, dayRate: 544, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plasterer', state: 'VIC', hourlyRate: 72, dayRate: 576, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Concreter', state: 'VIC', hourlyRate: 78, dayRate: 624, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Labourer', state: 'VIC', hourlyRate: 52, dayRate: 416, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },

  // QLD
  { trade: 'Carpenter', state: 'QLD', hourlyRate: 80, dayRate: 640, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plumber', state: 'QLD', hourlyRate: 90, dayRate: 720, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Electrician', state: 'QLD', hourlyRate: 90, dayRate: 720, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Tiler', state: 'QLD', hourlyRate: 75, dayRate: 600, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Painter', state: 'QLD', hourlyRate: 65, dayRate: 520, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plasterer', state: 'QLD', hourlyRate: 70, dayRate: 560, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Concreter', state: 'QLD', hourlyRate: 75, dayRate: 600, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Labourer', state: 'QLD', hourlyRate: 50, dayRate: 400, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },

  // WA
  { trade: 'Carpenter', state: 'WA', hourlyRate: 88, dayRate: 704, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plumber', state: 'WA', hourlyRate: 98, dayRate: 784, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Electrician', state: 'WA', hourlyRate: 98, dayRate: 784, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Tiler', state: 'WA', hourlyRate: 82, dayRate: 656, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Painter', state: 'WA', hourlyRate: 72, dayRate: 576, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plasterer', state: 'WA', hourlyRate: 78, dayRate: 624, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Concreter', state: 'WA', hourlyRate: 82, dayRate: 656, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Labourer', state: 'WA', hourlyRate: 58, dayRate: 464, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },

  // SA
  { trade: 'Carpenter', state: 'SA', hourlyRate: 78, dayRate: 624, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plumber', state: 'SA', hourlyRate: 88, dayRate: 704, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Electrician', state: 'SA', hourlyRate: 88, dayRate: 704, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Tiler', state: 'SA', hourlyRate: 72, dayRate: 576, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Painter', state: 'SA', hourlyRate: 62, dayRate: 496, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plasterer', state: 'SA', hourlyRate: 68, dayRate: 544, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Concreter', state: 'SA', hourlyRate: 72, dayRate: 576, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Labourer', state: 'SA', hourlyRate: 48, dayRate: 384, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },

  // TAS
  { trade: 'Carpenter', state: 'TAS', hourlyRate: 75, dayRate: 600, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plumber', state: 'TAS', hourlyRate: 85, dayRate: 680, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Electrician', state: 'TAS', hourlyRate: 85, dayRate: 680, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Tiler', state: 'TAS', hourlyRate: 70, dayRate: 560, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Painter', state: 'TAS', hourlyRate: 60, dayRate: 480, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plasterer', state: 'TAS', hourlyRate: 65, dayRate: 520, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Concreter', state: 'TAS', hourlyRate: 70, dayRate: 560, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Labourer', state: 'TAS', hourlyRate: 45, dayRate: 360, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },

  // NT
  { trade: 'Carpenter', state: 'NT', hourlyRate: 92, dayRate: 736, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plumber', state: 'NT', hourlyRate: 105, dayRate: 840, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Electrician', state: 'NT', hourlyRate: 105, dayRate: 840, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Tiler', state: 'NT', hourlyRate: 85, dayRate: 680, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Painter', state: 'NT', hourlyRate: 75, dayRate: 600, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plasterer', state: 'NT', hourlyRate: 80, dayRate: 640, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Concreter', state: 'NT', hourlyRate: 88, dayRate: 704, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Labourer', state: 'NT', hourlyRate: 60, dayRate: 480, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },

  // ACT
  { trade: 'Carpenter', state: 'ACT', hourlyRate: 88, dayRate: 704, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plumber', state: 'ACT', hourlyRate: 98, dayRate: 784, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Electrician', state: 'ACT', hourlyRate: 98, dayRate: 784, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Tiler', state: 'ACT', hourlyRate: 82, dayRate: 656, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Painter', state: 'ACT', hourlyRate: 72, dayRate: 576, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Plasterer', state: 'ACT', hourlyRate: 78, dayRate: 624, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Concreter', state: 'ACT', hourlyRate: 82, dayRate: 656, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
  { trade: 'Labourer', state: 'ACT', hourlyRate: 55, dayRate: 440, unit: 'hr', lastUpdated: '2024-01-01', source: 'Industry Average' },
];

// Default SOW rates (scope of work pricing)
export const DEFAULT_SOW_RATES: SOWRate[] = [
  // Bathroom work
  { trade: 'Plumber', sowType: 'Bathroom Rough-In', description: 'Complete rough-in for standard bathroom', state: 'NSW', unit: 'allow', minRate: 2000, maxRate: 2800, avgRate: 2400, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: false },
  { trade: 'Plumber', sowType: 'Bathroom Fit-Off', description: 'Connect all fixtures', state: 'NSW', unit: 'allow', minRate: 1500, maxRate: 2200, avgRate: 1800, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: false },
  { trade: 'Tiler', sowType: 'Floor Tiling', description: 'Lay floor tiles (labour only)', state: 'NSW', unit: 'm²', minRate: 75, maxRate: 100, avgRate: 85, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: false },
  { trade: 'Tiler', sowType: 'Wall Tiling', description: 'Lay wall tiles (labour only)', state: 'NSW', unit: 'm²', minRate: 85, maxRate: 110, avgRate: 95, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: false },
  { trade: 'Waterproofer', sowType: 'Shower Waterproofing', description: 'Waterproof shower recess', state: 'NSW', unit: 'm²', minRate: 85, maxRate: 110, avgRate: 95, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },

  // Electrical work
  { trade: 'Electrician', sowType: 'Power Point', description: 'Supply and install GPO', state: 'NSW', unit: 'ea', minRate: 55, maxRate: 80, avgRate: 65, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },
  { trade: 'Electrician', sowType: 'Light Point', description: 'Supply and install light point', state: 'NSW', unit: 'ea', minRate: 65, maxRate: 90, avgRate: 75, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },
  { trade: 'Electrician', sowType: 'LED Downlight', description: 'Supply and install LED downlight', state: 'NSW', unit: 'ea', minRate: 85, maxRate: 120, avgRate: 95, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },
  { trade: 'Electrician', sowType: 'Switchboard Upgrade', description: 'Replace switchboard with RCD board', state: 'NSW', unit: 'ea', minRate: 1500, maxRate: 2200, avgRate: 1800, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },

  // Carpentry
  { trade: 'Carpenter', sowType: 'Internal Door Hang', description: 'Hang internal door with hardware', state: 'NSW', unit: 'ea', minRate: 150, maxRate: 220, avgRate: 180, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: false },
  { trade: 'Carpenter', sowType: 'Deck Subframe', description: 'Build deck bearers and joists', state: 'NSW', unit: 'm²', minRate: 120, maxRate: 180, avgRate: 145, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: false },
  { trade: 'Carpenter', sowType: 'Deck Boards', description: 'Lay decking boards', state: 'NSW', unit: 'm²', minRate: 100, maxRate: 150, avgRate: 120, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: false },
  { trade: 'Carpenter', sowType: 'Balustrade', description: 'Supply and install compliant balustrade', state: 'NSW', unit: 'lm', minRate: 250, maxRate: 350, avgRate: 280, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },

  // Painting
  { trade: 'Painter', sowType: 'Interior Walls', description: 'Prepare and paint walls (2 coats)', state: 'NSW', unit: 'm²', minRate: 20, maxRate: 32, avgRate: 25, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },
  { trade: 'Painter', sowType: 'Interior Ceilings', description: 'Prepare and paint ceilings (2 coats)', state: 'NSW', unit: 'm²', minRate: 22, maxRate: 35, avgRate: 28, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },
  { trade: 'Painter', sowType: 'Exterior Walls', description: 'Prepare and paint exterior (2 coats)', state: 'NSW', unit: 'm²', minRate: 28, maxRate: 40, avgRate: 32, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },

  // Plastering
  { trade: 'Plasterer', sowType: 'Plasterboard Install', description: 'Supply and install 10mm plasterboard', state: 'NSW', unit: 'm²', minRate: 32, maxRate: 48, avgRate: 38, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },
  { trade: 'Plasterer', sowType: 'Plasterboard Set', description: 'Set and sand plasterboard', state: 'NSW', unit: 'm²', minRate: 14, maxRate: 24, avgRate: 18, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },

  // Concrete
  { trade: 'Concreter', sowType: 'Slab on Ground', description: 'Pour and finish 100mm slab with mesh', state: 'NSW', unit: 'm²', minRate: 120, maxRate: 180, avgRate: 145, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },
  { trade: 'Concreter', sowType: 'Footpath/Driveway', description: 'Pour and finish 100mm path', state: 'NSW', unit: 'm²', minRate: 80, maxRate: 120, avgRate: 95, lastUpdated: '2024-01-01', includesLabour: true, includesMaterials: true },
];

// Market Insights API
export const marketInsightsApi = {
  /**
   * Get labour rates by state
   */
  getLabourRates(state?: AustralianState): LabourRate[] {
    if (state) {
      return DEFAULT_LABOUR_RATES.filter(r => r.state === state);
    }
    return DEFAULT_LABOUR_RATES;
  },

  /**
   * Get labour rate for specific trade and state
   */
  getLabourRate(trade: string, state: AustralianState): LabourRate | undefined {
    return DEFAULT_LABOUR_RATES.find(
      r => r.trade.toLowerCase() === trade.toLowerCase() && r.state === state
    );
  },

  /**
   * Get SOW rates by trade
   */
  getSOWRates(trade?: string, state?: AustralianState): SOWRate[] {
    let rates = [...DEFAULT_SOW_RATES];

    if (trade) {
      rates = rates.filter(r => r.trade.toLowerCase() === trade.toLowerCase());
    }
    if (state) {
      rates = rates.filter(r => r.state === state);
    }

    return rates;
  },

  /**
   * Get SOW rate for specific work
   */
  getSOWRate(trade: string, sowType: string, state: AustralianState = 'NSW'): SOWRate | undefined {
    return DEFAULT_SOW_RATES.find(
      r => r.trade.toLowerCase() === trade.toLowerCase() &&
           r.sowType.toLowerCase() === sowType.toLowerCase() &&
           r.state === state
    );
  },

  /**
   * Get material prices from database
   */
  async getMaterialPrices(category?: string, state?: AustralianState): Promise<ApiResponse<MaterialPrice[]>> {
    try {
      let query = supabase
        .from('material_prices')
        .select('*')
        .eq('is_active', true)
        .order('product_name', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapMaterialPriceFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Search material prices
   */
  async searchMaterials(query: string): Promise<ApiResponse<MaterialPrice[]>> {
    try {
      const { data, error } = await supabase
        .from('material_prices')
        .select('*')
        .eq('is_active', true)
        .ilike('product_name', `%${query}%`)
        .limit(20);

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapMaterialPriceFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Compare prices across suppliers
   */
  async comparePrices(productName: string): Promise<ApiResponse<MaterialPrice[]>> {
    try {
      const { data, error } = await supabase
        .from('material_prices')
        .select('*')
        .eq('is_active', true)
        .ilike('product_name', `%${productName}%`)
        .order('price', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        data: data.map(mapMaterialPriceFromDb)
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get suppliers by category and state
   */
  async getSuppliers(category?: string, state?: AustralianState): Promise<ApiResponse<SupplierInfo[]>> {
    try {
      let query = supabase
        .from('suppliers')
        .select('id, business_name, state, categories, phone, email, website, rating, is_preferred')
        .eq('is_active', true);

      if (state) {
        query = query.eq('state', state);
      }
      if (category) {
        query = query.contains('categories', [category]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data.map(s => ({
          id: s.id,
          name: s.business_name,
          state: s.state as AustralianState,
          category: s.categories?.[0] || 'General',
          phone: s.phone,
          email: s.email,
          website: s.website,
          rating: s.rating,
          isPreferred: s.is_preferred
        }))
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Register price webhook for supplier
   */
  async registerPriceWebhook(input: Omit<PriceWebhook, 'id' | 'lastSyncAt'>): Promise<ApiResponse<PriceWebhook>> {
    try {
      const webhook = {
        supplier_id: input.supplierId,
        webhook_url: input.webhookUrl,
        api_key: input.apiKey,
        categories: input.categories,
        is_active: input.isActive,
        sync_frequency: input.syncFrequency
      };

      const { data, error } = await supabase
        .from('price_webhooks')
        .insert(webhook)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: mapPriceWebhookFromDb(data),
        message: 'Price webhook registered'
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Trigger price sync for webhook
   */
  async syncPrices(webhookId: string): Promise<ApiResponse<{ updated: number }>> {
    try {
      // Get webhook details
      const { data: webhook } = await supabase
        .from('price_webhooks')
        .select('*')
        .eq('id', webhookId)
        .single();

      if (!webhook) {
        return { success: false, error: 'Webhook not found' };
      }

      // In production, this would call the supplier's API
      // For now, we'll simulate a sync
      const updated = 0;

      // Update last sync time
      await supabase
        .from('price_webhooks')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', webhookId);

      return {
        success: true,
        data: { updated },
        message: `Synced ${updated} prices`
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all available trades
   */
  getTrades(): string[] {
    return [...new Set(DEFAULT_LABOUR_RATES.map(r => r.trade))].sort();
  },

  /**
   * Get all SOW types for a trade
   */
  getSOWTypes(trade: string): string[] {
    return [...new Set(
      DEFAULT_SOW_RATES
        .filter(r => r.trade.toLowerCase() === trade.toLowerCase())
        .map(r => r.sowType)
    )].sort();
  },

  /**
   * Calculate labour cost
   */
  calculateLabourCost(trade: string, state: AustralianState, hours: number): number {
    const rate = this.getLabourRate(trade, state);
    return rate ? rate.hourlyRate * hours : 0;
  },

  /**
   * Get state comparison for a trade
   */
  getStateComparison(trade: string): { state: AustralianState; hourlyRate: number }[] {
    return DEFAULT_LABOUR_RATES
      .filter(r => r.trade.toLowerCase() === trade.toLowerCase())
      .map(r => ({ state: r.state, hourlyRate: r.hourlyRate }))
      .sort((a, b) => a.hourlyRate - b.hourlyRate);
  }
};

// Helper functions
function mapMaterialPriceFromDb(data: any): MaterialPrice {
  return {
    id: data.id,
    productCode: data.product_code,
    productName: data.product_name,
    brand: data.brand,
    category: data.category,
    supplier: data.supplier,
    state: data.state || 'NSW',
    unit: data.unit,
    price: data.price,
    previousPrice: data.previous_price,
    priceUpdatedAt: data.price_updated_at,
    inStock: data.in_stock,
    leadTimeDays: data.lead_time_days
  };
}

function mapPriceWebhookFromDb(data: any): PriceWebhook {
  return {
    id: data.id,
    supplierId: data.supplier_id,
    webhookUrl: data.webhook_url,
    apiKey: data.api_key,
    categories: data.categories || [],
    isActive: data.is_active,
    lastSyncAt: data.last_sync_at,
    syncFrequency: data.sync_frequency
  };
}
