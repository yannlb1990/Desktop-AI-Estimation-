// Subcontractor Price Book System
// Track and manage subcontractor rates with history and comparison

export interface Subcontractor {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  abn?: string;
  licenseNumber?: string;
  trades: string[];
  serviceAreas: string[]; // postcodes or suburbs
  rating: number; // 1-5
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubbieRate {
  id: string;
  subbieId: string;
  trade: string;
  sowType: string;
  description: string;
  unit: 'hr' | 'day' | 'lm' | 'm²' | 'm³' | 'ea' | 'allow';
  rate: number;
  minCallOut?: number;
  includesGst: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  notes?: string;
  verified: boolean;
  lastUsed?: Date;
}

export interface RateHistory {
  id: string;
  subbieRateId: string;
  previousRate: number;
  newRate: number;
  changePercent: number;
  changedAt: Date;
  reason?: string;
}

export interface SubbiePriceBook {
  subcontractors: Subcontractor[];
  rates: SubbieRate[];
  history: RateHistory[];
}

// Default subbie rates by trade (Australian market)
export const DEFAULT_SUBBIE_RATES: Omit<SubbieRate, 'id' | 'subbieId'>[] = [
  // Plumbing
  {
    trade: 'Plumber',
    sowType: 'Hourly Rate',
    description: 'Standard hourly rate for plumbing work',
    unit: 'hr',
    rate: 95,
    minCallOut: 150,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Plumber',
    sowType: 'Bathroom Rough-In',
    description: 'Complete rough-in for standard bathroom (toilet, basin, shower)',
    unit: 'allow',
    rate: 2200,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Plumber',
    sowType: 'Bathroom Fit-Off',
    description: 'Connect all fixtures for standard bathroom',
    unit: 'allow',
    rate: 1800,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Plumber',
    sowType: 'Hot Water System',
    description: 'Supply and install electric/gas hot water system',
    unit: 'ea',
    rate: 1800,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },

  // Electrical
  {
    trade: 'Electrician',
    sowType: 'Hourly Rate',
    description: 'Standard hourly rate for electrical work',
    unit: 'hr',
    rate: 95,
    minCallOut: 120,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Electrician',
    sowType: 'Power Point',
    description: 'Supply and install single GPO',
    unit: 'ea',
    rate: 65,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Electrician',
    sowType: 'Light Point',
    description: 'Supply and install standard light point',
    unit: 'ea',
    rate: 75,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Electrician',
    sowType: 'Downlight LED',
    description: 'Supply and install LED downlight',
    unit: 'ea',
    rate: 95,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Electrician',
    sowType: 'Switchboard Upgrade',
    description: 'Replace old switchboard with new RCD board',
    unit: 'ea',
    rate: 1800,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },

  // Tiling
  {
    trade: 'Tiler',
    sowType: 'Floor Tiling',
    description: 'Supply and lay floor tiles (customer supplies tiles)',
    unit: 'm²',
    rate: 85,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Tiler',
    sowType: 'Wall Tiling',
    description: 'Supply and lay wall tiles (customer supplies tiles)',
    unit: 'm²',
    rate: 95,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Tiler',
    sowType: 'Floor Tiling with Supply',
    description: 'Supply standard tiles and lay floor',
    unit: 'm²',
    rate: 145,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Tiler',
    sowType: 'Wall Tiling with Supply',
    description: 'Supply standard tiles and lay walls',
    unit: 'm²',
    rate: 135,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },

  // Waterproofing
  {
    trade: 'Waterproofer',
    sowType: 'Shower Waterproofing',
    description: 'Waterproof shower recess per AS3740',
    unit: 'm²',
    rate: 95,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Waterproofer',
    sowType: 'Bathroom Floor',
    description: 'Waterproof bathroom floor per AS3740',
    unit: 'm²',
    rate: 75,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Waterproofer',
    sowType: 'Certificate',
    description: 'Waterproofing compliance certificate',
    unit: 'ea',
    rate: 150,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },

  // Painting
  {
    trade: 'Painter',
    sowType: 'Interior Walls',
    description: 'Prepare and paint interior walls (2 coats)',
    unit: 'm²',
    rate: 25,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Painter',
    sowType: 'Interior Ceilings',
    description: 'Prepare and paint interior ceilings (2 coats)',
    unit: 'm²',
    rate: 28,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Painter',
    sowType: 'Exterior Walls',
    description: 'Prepare and paint exterior (2 coats)',
    unit: 'm²',
    rate: 32,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Painter',
    sowType: 'Doors',
    description: 'Paint door both sides including frame',
    unit: 'ea',
    rate: 85,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },

  // Carpentry
  {
    trade: 'Carpenter',
    sowType: 'Hourly Rate',
    description: 'Standard hourly rate for carpentry work',
    unit: 'hr',
    rate: 85,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Carpenter',
    sowType: 'Internal Door Hang',
    description: 'Hang internal door including hardware',
    unit: 'ea',
    rate: 180,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Carpenter',
    sowType: 'Deck Subframe',
    description: 'Build deck subframe (bearers and joists)',
    unit: 'm²',
    rate: 145,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Carpenter',
    sowType: 'Deck Boards',
    description: 'Lay decking boards',
    unit: 'm²',
    rate: 120,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Carpenter',
    sowType: 'Balustrade',
    description: 'Supply and install compliant balustrade',
    unit: 'lm',
    rate: 280,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },

  // Plastering
  {
    trade: 'Plasterer',
    sowType: 'Plasterboard Install',
    description: 'Supply and install 10mm plasterboard',
    unit: 'm²',
    rate: 38,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Plasterer',
    sowType: 'Plasterboard Set',
    description: 'Plasterboard setting and sanding',
    unit: 'm²',
    rate: 18,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Plasterer',
    sowType: 'Cornice',
    description: 'Supply and install cove cornice',
    unit: 'lm',
    rate: 18,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },

  // Concreting
  {
    trade: 'Concreter',
    sowType: 'Slab on Ground',
    description: 'Pour and finish 100mm slab with mesh',
    unit: 'm²',
    rate: 145,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Concreter',
    sowType: 'Footpath/Driveway',
    description: 'Pour and finish 100mm footpath/driveway',
    unit: 'm²',
    rate: 95,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Concreter',
    sowType: 'Pier Footings',
    description: 'Excavate and pour pier footings',
    unit: 'ea',
    rate: 185,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },

  // Demolition
  {
    trade: 'Demolition',
    sowType: 'Bathroom Stripout',
    description: 'Complete bathroom stripout and disposal',
    unit: 'allow',
    rate: 1800,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Demolition',
    sowType: 'Kitchen Stripout',
    description: 'Complete kitchen stripout and disposal',
    unit: 'allow',
    rate: 2200,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  },
  {
    trade: 'Demolition',
    sowType: 'Skip Bin 4m³',
    description: 'Supply skip bin 4m³ with disposal',
    unit: 'ea',
    rate: 450,
    includesGst: false,
    effectiveFrom: new Date('2024-01-01'),
    verified: true
  }
];

// Helper functions
export function getSubbieRatesByTrade(rates: SubbieRate[], trade: string): SubbieRate[] {
  return rates.filter(r => r.trade.toLowerCase() === trade.toLowerCase());
}

export function getActiveRates(rates: SubbieRate[]): SubbieRate[] {
  const now = new Date();
  return rates.filter(r => {
    const isStarted = r.effectiveFrom <= now;
    const notExpired = !r.effectiveTo || r.effectiveTo >= now;
    return isStarted && notExpired;
  });
}

export function calculateRateChange(oldRate: number, newRate: number): number {
  if (oldRate === 0) return 0;
  return ((newRate - oldRate) / oldRate) * 100;
}

export function findBestRate(
  rates: SubbieRate[],
  trade: string,
  sowType: string
): SubbieRate | undefined {
  const matching = rates.filter(r =>
    r.trade.toLowerCase() === trade.toLowerCase() &&
    r.sowType.toLowerCase().includes(sowType.toLowerCase())
  );

  if (matching.length === 0) return undefined;

  // Return the lowest rate among active rates
  return matching.reduce((best, current) =>
    current.rate < best.rate ? current : best
  );
}

export function getTradesList(rates: SubbieRate[]): string[] {
  return [...new Set(rates.map(r => r.trade))].sort();
}

export function getSowTypesByTrade(rates: SubbieRate[], trade: string): string[] {
  return [...new Set(
    rates
      .filter(r => r.trade.toLowerCase() === trade.toLowerCase())
      .map(r => r.sowType)
  )].sort();
}

// Price trend analysis
export function analyzeRateTrend(
  history: RateHistory[],
  subbieRateId: string
): {
  trend: 'up' | 'down' | 'stable';
  avgChange: number;
  lastChange: number;
  changeCount: number;
} {
  const relevant = history
    .filter(h => h.subbieRateId === subbieRateId)
    .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

  if (relevant.length === 0) {
    return { trend: 'stable', avgChange: 0, lastChange: 0, changeCount: 0 };
  }

  const avgChange = relevant.reduce((sum, h) => sum + h.changePercent, 0) / relevant.length;
  const lastChange = relevant[0].changePercent;

  let trend: 'up' | 'down' | 'stable';
  if (avgChange > 2) trend = 'up';
  else if (avgChange < -2) trend = 'down';
  else trend = 'stable';

  return {
    trend,
    avgChange,
    lastChange,
    changeCount: relevant.length
  };
}
