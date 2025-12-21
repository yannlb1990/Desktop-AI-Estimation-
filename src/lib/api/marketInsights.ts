// Market Insights API Layer
// Provides unified access to material suppliers, labour rates, and SOW pricing

import { supabase } from '@/integrations/supabase/client';
import {
  MARKET_LABOUR_RATES,
  RATE_METADATA,
  getStateRate,
  getAllRatesForTrade,
  getTradesByCategory,
  isDataFresh as isLabourDataFresh,
  getDataAge as getLabourDataAge,
  type AustralianState,
  type LabourRate
} from '@/data/marketLabourRates';

import {
  SCOPE_OF_WORK_RATES,
  SOW_METADATA,
  getSOWByTrade,
  getSOWByCategory,
  searchSOW,
  getAllSOWRates,
  isDataFresh as isSOWDataFresh,
  getDataAge as getSOWDataAge,
  type SOWRate
} from '@/data/scopeOfWorkRates';

import {
  SUPPLIER_DATABASE,
  getSuppliersByState,
  getTopSuppliers,
  searchSupplierProducts,
  type Supplier,
  type StateSuppliers
} from '@/data/supplierDatabase';

// Types
export interface MaterialSearchResult {
  supplier: string;
  searchUrl: string;
  websiteUrl: string;
  description: string;
  type: string;
  priceLevel: string;
  tradeDiscount: boolean;
  deliveryAvailable: boolean;
  rating: number;
  state: AustralianState;
}

export interface MaterialSearchResponse {
  searchTerm: string;
  state: AustralianState;
  category: string;
  needsClarification: boolean;
  suggestions: { type: string; examples: string[] }[];
  results: MaterialSearchResult[];
  metadata: {
    totalSuppliers: number;
    stateFullName: string;
    lastUpdated: string;
  };
}

export interface LabourRateResponse {
  trade: string;
  category: string;
  rates: Record<AustralianState, number>;
  nationalAverage: number;
  minMax: {
    min: number;
    max: number;
    minState: string;
    maxState: string;
  };
  metadata: {
    lastUpdated: string;
    source: string;
    isFresh: boolean;
    ageInDays: number;
  };
}

export interface SOWRateResponse {
  id: string;
  trade: string;
  sow: string;
  unit: string;
  description: string;
  category: string;
  rates: Record<AustralianState, number>;
  metadata: {
    lastUpdated: string;
    source: string;
    isFresh: boolean;
    ageInDays: number;
  };
}

export interface DataFreshnessStatus {
  labour: {
    isFresh: boolean;
    ageInDays: number;
    lastUpdated: string;
    nextUpdate: string;
    source: string;
  };
  sow: {
    isFresh: boolean;
    ageInDays: number;
    lastUpdated: string;
    nextUpdate: string;
    source: string;
  };
}

// Material Search API
export const searchMaterials = async (
  searchTerm: string,
  state: AustralianState = 'NSW',
  limit: number = 5
): Promise<MaterialSearchResponse> => {
  try {
    // Try Edge Function first for AI-enhanced search
    const { data, error } = await supabase.functions.invoke('ai-material-search', {
      body: { searchTerm, state, limit }
    });

    if (!error && data) {
      return data as MaterialSearchResponse;
    }

    // Fallback to local data
    const suppliers = getTopSuppliers(state, limit);
    const results: MaterialSearchResult[] = suppliers.map(supplier => ({
      supplier: supplier.name,
      searchUrl: `${supplier.searchUrl}${encodeURIComponent(searchTerm)}`,
      websiteUrl: supplier.url,
      description: supplier.description,
      type: supplier.type,
      priceLevel: supplier.priceLevel,
      tradeDiscount: supplier.tradeDiscount,
      deliveryAvailable: supplier.deliveryAvailable,
      rating: supplier.rating,
      state,
    }));

    return {
      searchTerm,
      state,
      category: 'general',
      needsClarification: false,
      suggestions: [],
      results,
      metadata: {
        totalSuppliers: results.length,
        stateFullName: getStateName(state),
        lastUpdated: '2025-12-01',
      }
    };
  } catch (error) {
    console.error('Material search error:', error);
    throw error;
  }
};

// Get suppliers for a state
export const getSuppliersForState = (state: AustralianState): Supplier[] => {
  return getSuppliersByState(state);
};

// Labour Rates API
export const getLabourRate = (trade: string, state: AustralianState): number => {
  return getStateRate(trade, state);
};

export const getLabourRateDetails = (trade: string): LabourRateResponse | null => {
  const rateEntry = MARKET_LABOUR_RATES.find(r => r.trade === trade);
  if (!rateEntry) return null;

  const rates = getAllRatesForTrade(trade);
  if (!rates) return null;

  const rateValues = Object.values(rates);
  const nationalAverage = Math.round(rateValues.reduce((a, b) => a + b, 0) / rateValues.length);

  const states: AustralianState[] = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  let min = Infinity, max = -Infinity;
  let minState: AustralianState = 'NSW', maxState: AustralianState = 'NSW';

  states.forEach(state => {
    if (rates[state] < min) { min = rates[state]; minState = state; }
    if (rates[state] > max) { max = rates[state]; maxState = state; }
  });

  const dataAge = getLabourDataAge();

  return {
    trade: rateEntry.trade,
    category: rateEntry.category,
    rates,
    nationalAverage,
    minMax: { min, max, minState, maxState },
    metadata: {
      lastUpdated: rateEntry.lastUpdated,
      source: rateEntry.source,
      isFresh: dataAge.isFresh,
      ageInDays: dataAge.days,
    }
  };
};

export const getAllLabourRates = (): LabourRate[] => {
  return MARKET_LABOUR_RATES;
};

export const getLabourRatesByCategory = (category: string): LabourRate[] => {
  return getTradesByCategory(category);
};

// SOW Rates API
export const getSOWRateForState = (sowId: string, state: AustralianState): number | null => {
  const sow = SCOPE_OF_WORK_RATES.find(s => s.id === sowId);
  return sow ? sow[state] : null;
};

export const getSOWRateDetails = (sowId: string): SOWRateResponse | null => {
  const sow = SCOPE_OF_WORK_RATES.find(s => s.id === sowId);
  if (!sow) return null;

  const rates = getAllSOWRates(sowId);
  if (!rates) return null;

  const dataAge = getSOWDataAge();

  return {
    id: sow.id,
    trade: sow.trade,
    sow: sow.sow,
    unit: sow.unit,
    description: sow.description,
    category: sow.category,
    rates,
    metadata: {
      lastUpdated: sow.lastUpdated,
      source: sow.source,
      isFresh: dataAge.isFresh,
      ageInDays: dataAge.days,
    }
  };
};

export const getAllSOWRatesList = (): SOWRate[] => {
  return SCOPE_OF_WORK_RATES;
};

export const getSOWRatesForTrade = (trade: string): SOWRate[] => {
  return getSOWByTrade(trade);
};

export const getSOWRatesForCategory = (category: string): SOWRate[] => {
  return getSOWByCategory(category);
};

export const searchSOWRates = (searchTerm: string): SOWRate[] => {
  return searchSOW(searchTerm);
};

// Data Freshness API
export const getDataFreshnessStatus = (): DataFreshnessStatus => {
  const labourAge = getLabourDataAge();
  const sowAge = getSOWDataAge();

  return {
    labour: {
      isFresh: labourAge.isFresh,
      ageInDays: labourAge.days,
      lastUpdated: RATE_METADATA.lastUpdated,
      nextUpdate: RATE_METADATA.nextUpdate,
      source: RATE_METADATA.dataSource,
    },
    sow: {
      isFresh: sowAge.isFresh,
      ageInDays: sowAge.days,
      lastUpdated: SOW_METADATA.lastUpdated,
      nextUpdate: SOW_METADATA.nextUpdate,
      source: SOW_METADATA.dataSource,
    }
  };
};

export const isAllDataFresh = (): boolean => {
  return isLabourDataFresh() && isSOWDataFresh();
};

// Helper function
function getStateName(state: AustralianState): string {
  const names: Record<AustralianState, string> = {
    NSW: 'New South Wales',
    VIC: 'Victoria',
    QLD: 'Queensland',
    SA: 'South Australia',
    WA: 'Western Australia',
    TAS: 'Tasmania',
    NT: 'Northern Territory',
    ACT: 'Australian Capital Territory',
  };
  return names[state] || state;
}

// Export all types
export type { AustralianState, LabourRate, SOWRate, Supplier, StateSuppliers };
