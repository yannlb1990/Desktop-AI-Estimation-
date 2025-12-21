// Live Material Price Feed System
// Real-time material pricing with supplier comparison and price tracking

export interface MaterialPrice {
  id: string;
  sku?: string;
  name: string;
  category: string;
  subCategory?: string;
  brand?: string;
  unit: string;
  basePrice: number;
  gstIncluded: boolean;
  supplier: string;
  supplierUrl?: string;
  lastUpdated: Date;
  priceHistory: PricePoint[];
  inStock?: boolean;
  leadTime?: string;
}

export interface PricePoint {
  date: Date;
  price: number;
  source: string;
}

export interface PriceAlert {
  id: string;
  materialId: string;
  materialName: string;
  alertType: 'increase' | 'decrease' | 'threshold';
  threshold?: number; // percentage for change alerts, absolute for threshold
  currentPrice: number;
  previousPrice: number;
  changePercent: number;
  triggeredAt: Date;
  acknowledged: boolean;
}

export interface SupplierQuoteRequest {
  id: string;
  items: QuoteRequestItem[];
  projectName?: string;
  projectAddress?: string;
  requiredBy?: Date;
  notes?: string;
  suppliers: string[];
  status: 'draft' | 'sent' | 'partial' | 'complete';
  createdAt: Date;
  responses: SupplierQuoteResponse[];
}

export interface QuoteRequestItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  specifications?: string;
  preferredBrand?: string;
}

export interface SupplierQuoteResponse {
  id: string;
  requestId: string;
  supplier: string;
  items: QuoteResponseItem[];
  totalExGst: number;
  gst: number;
  totalIncGst: number;
  validUntil: Date;
  deliveryIncluded: boolean;
  deliveryCost?: number;
  leadTime: string;
  notes?: string;
  receivedAt: Date;
}

export interface QuoteResponseItem {
  requestItemId: string;
  available: boolean;
  unitPrice: number;
  totalPrice: number;
  brand?: string;
  sku?: string;
  notes?: string;
}

// Australian construction material categories
export const MATERIAL_CATEGORIES = [
  'Timber & Framing',
  'Plasterboard & Linings',
  'Roofing & Cladding',
  'Insulation',
  'Concrete & Cement',
  'Bricks & Blocks',
  'Tiles & Stone',
  'Plumbing',
  'Electrical',
  'Hardware & Fasteners',
  'Paint & Finishes',
  'Doors & Windows',
  'Flooring',
  'Bathroom Fixtures',
  'Kitchen Fixtures'
];

// Sample material prices (would be fetched from API in production)
export const SAMPLE_MATERIAL_PRICES: MaterialPrice[] = [
  // Timber & Framing
  {
    id: 'timber-1',
    name: '90x45 MGP10 Pine',
    category: 'Timber & Framing',
    unit: 'lm',
    basePrice: 3.15,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [
      { date: new Date('2024-01-01'), price: 2.85, source: 'Bunnings' },
      { date: new Date('2024-06-01'), price: 3.05, source: 'Bunnings' },
      { date: new Date('2024-12-01'), price: 3.15, source: 'Bunnings' }
    ],
    inStock: true
  },
  {
    id: 'timber-2',
    name: '90x45 MGP10 Pine',
    category: 'Timber & Framing',
    unit: 'lm',
    basePrice: 2.98,
    gstIncluded: false,
    supplier: 'Bowens',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'timber-3',
    name: '140x45 MGP10 Pine',
    category: 'Timber & Framing',
    unit: 'lm',
    basePrice: 5.25,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'timber-4',
    name: '90x35 Treated Pine H3',
    category: 'Timber & Framing',
    unit: 'lm',
    basePrice: 4.85,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },

  // Plasterboard
  {
    id: 'plaster-1',
    name: 'Plasterboard 10mm 2400x1200',
    category: 'Plasterboard & Linings',
    unit: 'sheet',
    basePrice: 16.50,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'plaster-2',
    name: 'Plasterboard 10mm 2400x1200',
    category: 'Plasterboard & Linings',
    unit: 'sheet',
    basePrice: 15.80,
    gstIncluded: false,
    supplier: 'CSR Gyprock Direct',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'plaster-3',
    name: 'Plasterboard 13mm Fire 2400x1200',
    category: 'Plasterboard & Linings',
    unit: 'sheet',
    basePrice: 24.50,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'plaster-4',
    name: 'Plasterboard 10mm Wet Area 2400x1200',
    category: 'Plasterboard & Linings',
    unit: 'sheet',
    basePrice: 28.00,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },

  // Roofing
  {
    id: 'roof-1',
    name: 'Colorbond Roofing Sheet',
    category: 'Roofing & Cladding',
    unit: 'lm',
    basePrice: 35.00,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'roof-2',
    name: 'Colorbond Roofing Sheet',
    category: 'Roofing & Cladding',
    unit: 'lm',
    basePrice: 33.50,
    gstIncluded: false,
    supplier: 'Stratco',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },

  // Insulation
  {
    id: 'insul-1',
    name: 'Ceiling Batts R4.0 580mm',
    category: 'Insulation',
    unit: 'm²',
    basePrice: 12.50,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'insul-2',
    name: 'Wall Batts R2.5 580mm',
    category: 'Insulation',
    unit: 'm²',
    basePrice: 8.50,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },

  // Concrete
  {
    id: 'conc-1',
    name: 'Concrete 25MPa',
    category: 'Concrete & Cement',
    unit: 'm³',
    basePrice: 265.00,
    gstIncluded: false,
    supplier: 'Boral Concrete',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true,
    leadTime: '1-2 days'
  },
  {
    id: 'conc-2',
    name: 'Concrete 32MPa',
    category: 'Concrete & Cement',
    unit: 'm³',
    basePrice: 285.00,
    gstIncluded: false,
    supplier: 'Boral Concrete',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true,
    leadTime: '1-2 days'
  },
  {
    id: 'conc-3',
    name: 'Cement Bag 20kg',
    category: 'Concrete & Cement',
    unit: 'bag',
    basePrice: 9.50,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },

  // Electrical
  {
    id: 'elec-1',
    name: '2.5mm TPS Cable 100m',
    category: 'Electrical',
    unit: 'roll',
    basePrice: 89.00,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'elec-2',
    name: '2.5mm TPS Cable 100m',
    category: 'Electrical',
    unit: 'roll',
    basePrice: 78.00,
    gstIncluded: false,
    supplier: 'Middy\'s',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'elec-3',
    name: 'LED Downlight 10W IP44',
    category: 'Electrical',
    unit: 'ea',
    basePrice: 18.50,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },

  // Plumbing
  {
    id: 'plumb-1',
    name: 'PVC Pipe 100mm DWV 6m',
    category: 'Plumbing',
    unit: 'length',
    basePrice: 65.00,
    gstIncluded: false,
    supplier: 'Reece',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'plumb-2',
    name: 'Copper Pipe 15mm 6m',
    category: 'Plumbing',
    unit: 'length',
    basePrice: 85.00,
    gstIncluded: false,
    supplier: 'Reece',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },

  // Tiles
  {
    id: 'tile-1',
    name: 'Floor Tile 600x600 (budget)',
    category: 'Tiles & Stone',
    unit: 'm²',
    basePrice: 28.00,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'tile-2',
    name: 'Wall Tile 300x600 (budget)',
    category: 'Tiles & Stone',
    unit: 'm²',
    basePrice: 32.00,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'tile-3',
    name: 'Tile Adhesive 20kg',
    category: 'Tiles & Stone',
    unit: 'bag',
    basePrice: 38.00,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  },
  {
    id: 'tile-4',
    name: 'Tile Grout 5kg',
    category: 'Tiles & Stone',
    unit: 'bag',
    basePrice: 22.00,
    gstIncluded: false,
    supplier: 'Bunnings',
    lastUpdated: new Date(),
    priceHistory: [],
    inStock: true
  }
];

// Price comparison functions
export function comparePrices(
  materials: MaterialPrice[],
  productName: string
): MaterialPrice[] {
  const normalizedSearch = productName.toLowerCase();
  return materials
    .filter(m => m.name.toLowerCase().includes(normalizedSearch))
    .sort((a, b) => a.basePrice - b.basePrice);
}

export function findBestPrice(
  materials: MaterialPrice[],
  productName: string
): MaterialPrice | undefined {
  const matches = comparePrices(materials, productName);
  return matches.length > 0 ? matches[0] : undefined;
}

export function calculateSavings(
  materials: MaterialPrice[],
  productName: string,
  quantity: number
): {
  cheapest: MaterialPrice | undefined;
  mostExpensive: MaterialPrice | undefined;
  savings: number;
  savingsPercent: number;
} {
  const matches = comparePrices(materials, productName);

  if (matches.length < 2) {
    return {
      cheapest: matches[0],
      mostExpensive: matches[0],
      savings: 0,
      savingsPercent: 0
    };
  }

  const cheapest = matches[0];
  const mostExpensive = matches[matches.length - 1];
  const savingsPerUnit = mostExpensive.basePrice - cheapest.basePrice;
  const totalSavings = savingsPerUnit * quantity;
  const savingsPercent = (savingsPerUnit / mostExpensive.basePrice) * 100;

  return {
    cheapest,
    mostExpensive,
    savings: totalSavings,
    savingsPercent
  };
}

// Price trend analysis
export function analyzePriceTrend(material: MaterialPrice): {
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  periodMonths: number;
} {
  const history = material.priceHistory;

  if (history.length < 2) {
    return { trend: 'stable', changePercent: 0, periodMonths: 0 };
  }

  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];

  const changePercent = ((newest.price - oldest.price) / oldest.price) * 100;
  const periodMonths = Math.round(
    (newest.date.getTime() - oldest.date.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  let trend: 'up' | 'down' | 'stable';
  if (changePercent > 2) trend = 'up';
  else if (changePercent < -2) trend = 'down';
  else trend = 'stable';

  return { trend, changePercent, periodMonths };
}

// Generate price alerts
export function checkPriceAlerts(
  materials: MaterialPrice[],
  previousPrices: Map<string, number>,
  threshold: number = 5 // percent
): PriceAlert[] {
  const alerts: PriceAlert[] = [];

  materials.forEach(material => {
    const previousPrice = previousPrices.get(material.id);
    if (previousPrice && previousPrice !== material.basePrice) {
      const changePercent = ((material.basePrice - previousPrice) / previousPrice) * 100;

      if (Math.abs(changePercent) >= threshold) {
        alerts.push({
          id: `alert-${material.id}-${Date.now()}`,
          materialId: material.id,
          materialName: material.name,
          alertType: changePercent > 0 ? 'increase' : 'decrease',
          currentPrice: material.basePrice,
          previousPrice,
          changePercent,
          triggeredAt: new Date(),
          acknowledged: false
        });
      }
    }
  });

  return alerts;
}

// Get materials by category
export function getMaterialsByCategory(
  materials: MaterialPrice[],
  category: string
): MaterialPrice[] {
  return materials.filter(m => m.category === category);
}

// Search materials
export function searchMaterials(
  materials: MaterialPrice[],
  query: string
): MaterialPrice[] {
  const lowerQuery = query.toLowerCase();
  return materials.filter(m =>
    m.name.toLowerCase().includes(lowerQuery) ||
    m.category.toLowerCase().includes(lowerQuery) ||
    (m.brand && m.brand.toLowerCase().includes(lowerQuery))
  );
}

// Calculate material cost for estimate line
export function calculateMaterialCost(
  materials: MaterialPrice[],
  itemName: string,
  quantity: number,
  preferredSupplier?: string
): {
  unitPrice: number;
  totalPrice: number;
  supplier: string;
  alternatives: { supplier: string; unitPrice: number; savings: number }[];
} {
  let matches = comparePrices(materials, itemName);

  if (preferredSupplier) {
    const preferred = matches.find(m =>
      m.supplier.toLowerCase() === preferredSupplier.toLowerCase()
    );
    if (preferred) {
      const alternatives = matches
        .filter(m => m.id !== preferred.id)
        .map(m => ({
          supplier: m.supplier,
          unitPrice: m.basePrice,
          savings: (preferred.basePrice - m.basePrice) * quantity
        }));

      return {
        unitPrice: preferred.basePrice,
        totalPrice: preferred.basePrice * quantity,
        supplier: preferred.supplier,
        alternatives
      };
    }
  }

  // Use cheapest if no preference or preferred not found
  const cheapest = matches[0];
  if (!cheapest) {
    return {
      unitPrice: 0,
      totalPrice: 0,
      supplier: 'Unknown',
      alternatives: []
    };
  }

  const alternatives = matches
    .slice(1)
    .map(m => ({
      supplier: m.supplier,
      unitPrice: m.basePrice,
      savings: (m.basePrice - cheapest.basePrice) * quantity * -1 // negative = costs more
    }));

  return {
    unitPrice: cheapest.basePrice,
    totalPrice: cheapest.basePrice * quantity,
    supplier: cheapest.supplier,
    alternatives
  };
}
