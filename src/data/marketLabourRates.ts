// Australian Market Labour Rates by State (2025)
// Source: Master Builders Association & HIA Industry Standards
// Rates are per hour including super and on-costs
// Data Freshness: Updated December 2025

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

export interface LabourRate {
  trade: string;
  category: string;
  NSW: number;
  VIC: number;
  QLD: number;
  SA: number;
  WA: number;
  TAS: number;
  NT: number;
  ACT: number;
  lastUpdated: string;
  source: string;
}

export interface RateMetadata {
  lastUpdated: string;
  nextUpdate: string;
  dataSource: string;
  version: string;
}

export const RATE_METADATA: RateMetadata = {
  lastUpdated: '2025-12-01',
  nextUpdate: '2026-03-01', // Quarterly updates
  dataSource: 'Master Builders Association, HIA, Fair Work Australia',
  version: '2025.4'
};

export const MARKET_LABOUR_RATES: LabourRate[] = [
  // STRUCTURAL TRADES
  { trade: "Carpenter", category: "Structural", NSW: 95, VIC: 90, QLD: 85, SA: 82, WA: 98, TAS: 80, NT: 105, ACT: 92, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Formwork Carpenter", category: "Structural", NSW: 100, VIC: 95, QLD: 90, SA: 88, WA: 105, TAS: 85, NT: 110, ACT: 98, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Steel Fixer", category: "Structural", NSW: 98, VIC: 92, QLD: 88, SA: 85, WA: 102, TAS: 82, NT: 105, ACT: 95, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Bricklayer", category: "Structural", NSW: 90, VIC: 85, QLD: 80, SA: 78, WA: 92, TAS: 75, NT: 95, ACT: 88, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Concreter", category: "Structural", NSW: 95, VIC: 90, QLD: 85, SA: 82, WA: 98, TAS: 80, NT: 102, ACT: 92, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Scaffolder", category: "Structural", NSW: 90, VIC: 85, QLD: 82, SA: 80, WA: 92, TAS: 78, NT: 95, ACT: 88, lastUpdated: "2025-12-01", source: "MBA" },

  // SERVICES TRADES
  { trade: "Plumber", category: "Services", NSW: 105, VIC: 100, QLD: 95, SA: 92, WA: 110, TAS: 90, NT: 115, ACT: 102, lastUpdated: "2025-12-01", source: "HIA" },
  { trade: "Electrician", category: "Services", NSW: 110, VIC: 105, QLD: 100, SA: 95, WA: 115, TAS: 95, NT: 120, ACT: 108, lastUpdated: "2025-12-01", source: "HIA" },
  { trade: "HVAC Technician", category: "Services", NSW: 108, VIC: 102, QLD: 98, SA: 95, WA: 112, TAS: 92, NT: 118, ACT: 105, lastUpdated: "2025-12-01", source: "HIA" },
  { trade: "Gas Fitter", category: "Services", NSW: 102, VIC: 97, QLD: 92, SA: 90, WA: 108, TAS: 88, NT: 112, ACT: 100, lastUpdated: "2025-12-01", source: "HIA" },
  { trade: "Fire Protection Technician", category: "Services", NSW: 115, VIC: 110, QLD: 105, SA: 100, WA: 120, TAS: 98, NT: 125, ACT: 112, lastUpdated: "2025-12-01", source: "HIA" },

  // FINISHING TRADES
  { trade: "Plasterer", category: "Finishing", NSW: 85, VIC: 80, QLD: 78, SA: 75, WA: 88, TAS: 72, NT: 92, ACT: 82, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Painter", category: "Finishing", NSW: 80, VIC: 75, QLD: 72, SA: 70, WA: 82, TAS: 68, NT: 85, ACT: 78, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Tiler", category: "Finishing", NSW: 90, VIC: 85, QLD: 82, SA: 80, WA: 92, TAS: 78, NT: 95, ACT: 88, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Renderer", category: "Finishing", NSW: 88, VIC: 83, QLD: 80, SA: 78, WA: 90, TAS: 75, NT: 92, ACT: 85, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Floor Sander", category: "Finishing", NSW: 82, VIC: 78, QLD: 75, SA: 72, WA: 85, TAS: 70, NT: 88, ACT: 80, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Glazier", category: "Finishing", NSW: 92, VIC: 88, QLD: 85, SA: 82, WA: 95, TAS: 80, NT: 98, ACT: 90, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Ceiling Fixer", category: "Finishing", NSW: 88, VIC: 83, QLD: 80, SA: 78, WA: 90, TAS: 75, NT: 92, ACT: 85, lastUpdated: "2025-12-01", source: "MBA" },

  // ROOFING & CLADDING
  { trade: "Roofer", category: "Roofing", NSW: 100, VIC: 95, QLD: 90, SA: 88, WA: 105, TAS: 85, NT: 110, ACT: 98, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Cladding Installer", category: "Roofing", NSW: 90, VIC: 85, QLD: 82, SA: 80, WA: 92, TAS: 78, NT: 95, ACT: 88, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Gutter Installer", category: "Roofing", NSW: 85, VIC: 80, QLD: 78, SA: 75, WA: 88, TAS: 72, NT: 90, ACT: 82, lastUpdated: "2025-12-01", source: "MBA" },

  // SPECIALIST TRADES
  { trade: "Stonemason", category: "Specialist", NSW: 105, VIC: 100, QLD: 95, SA: 92, WA: 110, TAS: 88, NT: 115, ACT: 102, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Cabinetmaker", category: "Specialist", NSW: 95, VIC: 90, QLD: 85, SA: 82, WA: 98, TAS: 80, NT: 102, ACT: 92, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Shopfitter", category: "Specialist", NSW: 92, VIC: 88, QLD: 85, SA: 82, WA: 95, TAS: 80, NT: 98, ACT: 90, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Waterproofer", category: "Specialist", NSW: 90, VIC: 85, QLD: 82, SA: 80, WA: 92, TAS: 78, NT: 95, ACT: 88, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Insulation Installer", category: "Specialist", NSW: 70, VIC: 65, QLD: 62, SA: 60, WA: 72, TAS: 58, NT: 75, ACT: 68, lastUpdated: "2025-12-01", source: "MBA" },

  // LANDSCAPING
  { trade: "Landscaper", category: "Landscaping", NSW: 85, VIC: 80, QLD: 75, SA: 72, WA: 88, TAS: 70, NT: 90, ACT: 82, lastUpdated: "2025-12-01", source: "MBA" },

  // DEMOLITION
  { trade: "Demolition Worker", category: "Demolition", NSW: 75, VIC: 70, QLD: 68, SA: 65, WA: 78, TAS: 62, NT: 80, ACT: 72, lastUpdated: "2025-12-01", source: "MBA" },

  // LABOUR
  { trade: "General Labourer", category: "Labour", NSW: 65, VIC: 60, QLD: 58, SA: 55, WA: 68, TAS: 52, NT: 70, ACT: 62, lastUpdated: "2025-12-01", source: "FWA" },
  { trade: "Skilled Labourer", category: "Labour", NSW: 72, VIC: 68, QLD: 65, SA: 62, WA: 75, TAS: 60, NT: 78, ACT: 70, lastUpdated: "2025-12-01", source: "FWA" },

  // PLANT OPERATORS
  { trade: "Crane Operator", category: "Plant", NSW: 120, VIC: 115, QLD: 110, SA: 105, WA: 125, TAS: 100, NT: 130, ACT: 118, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Excavator Operator", category: "Plant", NSW: 110, VIC: 105, QLD: 100, SA: 95, WA: 115, TAS: 92, NT: 120, ACT: 108, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Bobcat Operator", category: "Plant", NSW: 95, VIC: 90, QLD: 88, SA: 85, WA: 98, TAS: 82, NT: 102, ACT: 92, lastUpdated: "2025-12-01", source: "MBA" },
  { trade: "Forklift Operator", category: "Plant", NSW: 75, VIC: 70, QLD: 68, SA: 65, WA: 78, TAS: 62, NT: 80, ACT: 72, lastUpdated: "2025-12-01", source: "FWA" },
  { trade: "EWP Operator", category: "Plant", NSW: 85, VIC: 80, QLD: 78, SA: 75, WA: 88, TAS: 72, NT: 90, ACT: 82, lastUpdated: "2025-12-01", source: "MBA" },
];

// Helper functions
export const getStateRate = (trade: string, state: AustralianState): number => {
  const rateEntry = MARKET_LABOUR_RATES.find(r => r.trade === trade);
  return rateEntry ? rateEntry[state] : 90; // Default to $90/hr if not found
};

export const getAllTrades = (): string[] => {
  return MARKET_LABOUR_RATES.map(r => r.trade);
};

export const getTradesByCategory = (category: string): LabourRate[] => {
  return MARKET_LABOUR_RATES.filter(r => r.category === category);
};

export const getCategories = (): string[] => {
  return [...new Set(MARKET_LABOUR_RATES.map(r => r.category))];
};

export const getAverageRate = (trade: string): number => {
  const rateEntry = MARKET_LABOUR_RATES.find(r => r.trade === trade);
  if (!rateEntry) return 90;

  const rates = [rateEntry.NSW, rateEntry.VIC, rateEntry.QLD, rateEntry.SA, rateEntry.WA, rateEntry.TAS, rateEntry.NT, rateEntry.ACT];
  return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
};

export const getNationalMinMax = (trade: string): { min: number; max: number; minState: string; maxState: string } => {
  const rateEntry = MARKET_LABOUR_RATES.find(r => r.trade === trade);
  if (!rateEntry) return { min: 0, max: 0, minState: '', maxState: '' };

  const states: AustralianState[] = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  let min = Infinity, max = -Infinity;
  let minState = '', maxState = '';

  states.forEach(state => {
    const rate = rateEntry[state];
    if (rate < min) { min = rate; minState = state; }
    if (rate > max) { max = rate; maxState = state; }
  });

  return { min, max, minState, maxState };
};

export const getAllRatesForTrade = (trade: string): Record<AustralianState, number> | null => {
  const rateEntry = MARKET_LABOUR_RATES.find(r => r.trade === trade);
  if (!rateEntry) return null;

  return {
    NSW: rateEntry.NSW,
    VIC: rateEntry.VIC,
    QLD: rateEntry.QLD,
    SA: rateEntry.SA,
    WA: rateEntry.WA,
    TAS: rateEntry.TAS,
    NT: rateEntry.NT,
    ACT: rateEntry.ACT
  };
};

export const isDataFresh = (): boolean => {
  const lastUpdate = new Date(RATE_METADATA.lastUpdated);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return lastUpdate > sixMonthsAgo;
};

export const getDataAge = (): { days: number; isFresh: boolean } => {
  const lastUpdate = new Date(RATE_METADATA.lastUpdated);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return { days: diffDays, isFresh: diffDays <= 180 };
};

export const searchRates = (searchTerm: string): LabourRate[] => {
  const term = searchTerm.toLowerCase();
  return MARKET_LABOUR_RATES.filter(r =>
    r.trade.toLowerCase().includes(term) ||
    r.category.toLowerCase().includes(term)
  );
};
