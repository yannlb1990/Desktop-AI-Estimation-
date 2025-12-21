// Australian Building Material Suppliers Database
// Organized by state with URLs and contact info
// Last Updated: December 2025

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

export interface Supplier {
  name: string;
  type: 'hardware' | 'specialist' | 'wholesale' | 'trade' | 'online';
  url: string;
  searchUrl: string; // URL pattern for product search
  description: string;
  priceLevel: 'budget' | 'mid-range' | 'premium';
  tradeDiscount: boolean;
  deliveryAvailable: boolean;
  rating: number; // 1-5
}

export interface StateSuppliers {
  state: AustralianState;
  stateName: string;
  suppliers: Supplier[];
}

export const SUPPLIER_DATABASE: StateSuppliers[] = [
  {
    state: 'NSW',
    stateName: 'New South Wales',
    suppliers: [
      {
        name: 'Bunnings Warehouse',
        type: 'hardware',
        url: 'https://www.bunnings.com.au',
        searchUrl: 'https://www.bunnings.com.au/search/products?q=',
        description: "Australia's largest hardware retailer with over 150 stores in NSW. Wide range of building materials, tools, and supplies.",
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Mitre 10',
        type: 'hardware',
        url: 'https://www.mitre10.com.au',
        searchUrl: 'https://www.mitre10.com.au/search?text=',
        description: 'Independent hardware cooperative with strong trade support. Known for expert advice and local knowledge.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Total Tools',
        type: 'specialist',
        url: 'https://www.totaltools.com.au',
        searchUrl: 'https://www.totaltools.com.au/search?q=',
        description: 'Professional tool specialist with premium brands. Best for power tools, fasteners, and trade equipment.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.5
      },
      {
        name: 'Reece Plumbing',
        type: 'specialist',
        url: 'https://www.reece.com.au',
        searchUrl: 'https://www.reece.com.au/search?q=',
        description: 'Leading plumbing and bathroom supplier. Trade-focused with extensive product range and expertise.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.4
      },
      {
        name: 'Bowens',
        type: 'wholesale',
        url: 'https://www.bowens.com.au',
        searchUrl: 'https://www.bowens.com.au/search?q=',
        description: 'Trade timber and building supplies specialist. Excellent for framing, structural timber, and bulk orders.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.3
      },
      {
        name: 'Dahlsens',
        type: 'wholesale',
        url: 'https://www.dahlsens.com.au',
        searchUrl: 'https://www.dahlsens.com.au/search/',
        description: 'Family-owned building supplies since 1877. Strong in timber, hardware, and trade materials.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.1
      },
      {
        name: 'Sydney Build Supplies',
        type: 'wholesale',
        url: 'https://www.sydneybuildsupplies.com.au',
        searchUrl: 'https://www.sydneybuildsupplies.com.au/catalogsearch/result/?q=',
        description: 'Local Sydney supplier specializing in concrete, masonry, and landscaping materials.',
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 3.9
      }
    ]
  },
  {
    state: 'VIC',
    stateName: 'Victoria',
    suppliers: [
      {
        name: 'Bunnings Warehouse',
        type: 'hardware',
        url: 'https://www.bunnings.com.au',
        searchUrl: 'https://www.bunnings.com.au/search/products?q=',
        description: "Australia's largest hardware retailer. Extensive Victorian network with trade centers.",
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Mitre 10',
        type: 'hardware',
        url: 'https://www.mitre10.com.au',
        searchUrl: 'https://www.mitre10.com.au/search?text=',
        description: 'Strong Victorian presence with locally-owned stores. Good for regional deliveries.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Bowens',
        type: 'wholesale',
        url: 'https://www.bowens.com.au',
        searchUrl: 'https://www.bowens.com.au/search?q=',
        description: 'Melbourne-based timber and building supplies. Specialist in framing and structural materials.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.4
      },
      {
        name: 'Dahlsens',
        type: 'wholesale',
        url: 'https://www.dahlsens.com.au',
        searchUrl: 'https://www.dahlsens.com.au/search/',
        description: 'Victorian heritage company with 15+ locations. Strong timber and hardware range.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Highett Metal',
        type: 'specialist',
        url: 'https://www.highettmetal.com.au',
        searchUrl: 'https://www.highettmetal.com.au/search/',
        description: 'Melbourne metal and steel specialist. Cutting services and custom orders available.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.1
      },
      {
        name: 'Reece Plumbing',
        type: 'specialist',
        url: 'https://www.reece.com.au',
        searchUrl: 'https://www.reece.com.au/search?q=',
        description: 'Reece originated in Victoria. Headquarters in Melbourne with extensive branch network.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.5
      },
      {
        name: 'Total Tools',
        type: 'specialist',
        url: 'https://www.totaltools.com.au',
        searchUrl: 'https://www.totaltools.com.au/search?q=',
        description: 'Premium tool and equipment supplier. Trade accounts and professional advice.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.5
      }
    ]
  },
  {
    state: 'QLD',
    stateName: 'Queensland',
    suppliers: [
      {
        name: 'Bunnings Warehouse',
        type: 'hardware',
        url: 'https://www.bunnings.com.au',
        searchUrl: 'https://www.bunnings.com.au/search/products?q=',
        description: 'Comprehensive QLD coverage from Gold Coast to Cairns. Trade centers in major cities.',
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Mitre 10',
        type: 'hardware',
        url: 'https://www.mitre10.com.au',
        searchUrl: 'https://www.mitre10.com.au/search?text=',
        description: 'Strong regional QLD presence. Good for remote area deliveries.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Tradelink',
        type: 'specialist',
        url: 'https://www.tradelink.com.au',
        searchUrl: 'https://www.tradelink.com.au/search?q=',
        description: 'Plumbing and bathroom specialist with Queensland distribution network.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Hyne Timber',
        type: 'wholesale',
        url: 'https://www.hyne.com.au',
        searchUrl: 'https://www.hyne.com.au/products/',
        description: 'Queensland-based timber manufacturer. Direct supply of structural timber and LVL.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.3
      },
      {
        name: 'Finlaysons',
        type: 'wholesale',
        url: 'https://www.finlaysons.com.au',
        searchUrl: 'https://www.finlaysons.com.au/search/',
        description: 'QLD timber specialist since 1880. Premium hardwoods and engineered timber.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Total Tools',
        type: 'specialist',
        url: 'https://www.totaltools.com.au',
        searchUrl: 'https://www.totaltools.com.au/search?q=',
        description: 'Professional tools and equipment. Strong SEQ presence.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.5
      },
      {
        name: 'Reece Plumbing',
        type: 'specialist',
        url: 'https://www.reece.com.au',
        searchUrl: 'https://www.reece.com.au/search?q=',
        description: 'Full plumbing and bathroom range with QLD-wide delivery.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.4
      }
    ]
  },
  {
    state: 'SA',
    stateName: 'South Australia',
    suppliers: [
      {
        name: 'Bunnings Warehouse',
        type: 'hardware',
        url: 'https://www.bunnings.com.au',
        searchUrl: 'https://www.bunnings.com.au/search/products?q=',
        description: 'Adelaide metro and regional SA coverage. Trade services available.',
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Mitre 10',
        type: 'hardware',
        url: 'https://www.mitre10.com.au',
        searchUrl: 'https://www.mitre10.com.au/search?text=',
        description: 'Independent stores throughout SA with local expertise.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Mount Barker Timber',
        type: 'wholesale',
        url: 'https://www.mtbarkertimber.com.au',
        searchUrl: 'https://www.mtbarkertimber.com.au/search/',
        description: 'SA timber specialist with wide range of structural and finishing timbers.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.1
      },
      {
        name: 'Hindmarsh Plumbing Supplies',
        type: 'specialist',
        url: 'https://www.hindmarshplumbing.com.au',
        searchUrl: 'https://www.hindmarshplumbing.com.au/search/',
        description: 'Local SA plumbing wholesaler with competitive trade pricing.',
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Total Tools',
        type: 'specialist',
        url: 'https://www.totaltools.com.au',
        searchUrl: 'https://www.totaltools.com.au/search?q=',
        description: 'Professional tool supplier with Adelaide stores.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.5
      },
      {
        name: 'Reece Plumbing',
        type: 'specialist',
        url: 'https://www.reece.com.au',
        searchUrl: 'https://www.reece.com.au/search?q=',
        description: 'Full bathroom and plumbing range with SA coverage.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.4
      }
    ]
  },
  {
    state: 'WA',
    stateName: 'Western Australia',
    suppliers: [
      {
        name: 'Bunnings Warehouse',
        type: 'hardware',
        url: 'https://www.bunnings.com.au',
        searchUrl: 'https://www.bunnings.com.au/search/products?q=',
        description: 'Perth metro and WA regional coverage. Founded in WA in 1886.',
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.3
      },
      {
        name: 'Mitre 10',
        type: 'hardware',
        url: 'https://www.mitre10.com.au',
        searchUrl: 'https://www.mitre10.com.au/search?text=',
        description: 'WA stores with strong regional presence and delivery options.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Total Tools',
        type: 'specialist',
        url: 'https://www.totaltools.com.au',
        searchUrl: 'https://www.totaltools.com.au/search?q=',
        description: 'Perth metro locations with full professional tool range.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.5
      },
      {
        name: 'Midland Brick',
        type: 'specialist',
        url: 'https://www.midlandbrick.com.au',
        searchUrl: 'https://www.midlandbrick.com.au/products/',
        description: 'WA brick manufacturer with extensive range of clay bricks and pavers.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Galvin Hardware',
        type: 'wholesale',
        url: 'https://www.galvins.com.au',
        searchUrl: 'https://www.galvins.com.au/search/',
        description: 'WA-based hardware and building supplies. Strong trade focus.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.1
      },
      {
        name: 'Reece Plumbing',
        type: 'specialist',
        url: 'https://www.reece.com.au',
        searchUrl: 'https://www.reece.com.au/search?q=',
        description: 'Plumbing and bathroom supplies throughout WA.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.4
      }
    ]
  },
  {
    state: 'TAS',
    stateName: 'Tasmania',
    suppliers: [
      {
        name: 'Bunnings Warehouse',
        type: 'hardware',
        url: 'https://www.bunnings.com.au',
        searchUrl: 'https://www.bunnings.com.au/search/products?q=',
        description: 'Tasmania-wide coverage with stores in major centers.',
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Mitre 10',
        type: 'hardware',
        url: 'https://www.mitre10.com.au',
        searchUrl: 'https://www.mitre10.com.au/search?text=',
        description: 'Local TAS stores with community focus and expert advice.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.1
      },
      {
        name: 'Dahlsens',
        type: 'wholesale',
        url: 'https://www.dahlsens.com.au',
        searchUrl: 'https://www.dahlsens.com.au/search/',
        description: 'Tasmania branches with full building supplies range.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Tas Oak',
        type: 'specialist',
        url: 'https://www.tasoak.com.au',
        searchUrl: 'https://www.tasoak.com.au/products/',
        description: 'Premium Tasmanian Oak specialist. Flooring, furniture, and structural timber.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.4
      },
      {
        name: 'Reece Plumbing',
        type: 'specialist',
        url: 'https://www.reece.com.au',
        searchUrl: 'https://www.reece.com.au/search?q=',
        description: 'Plumbing supplies with Tasmanian branches.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.3
      }
    ]
  },
  {
    state: 'NT',
    stateName: 'Northern Territory',
    suppliers: [
      {
        name: 'Bunnings Warehouse',
        type: 'hardware',
        url: 'https://www.bunnings.com.au',
        searchUrl: 'https://www.bunnings.com.au/search/products?q=',
        description: 'Darwin and Alice Springs stores. Tropical-focused product range.',
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.1
      },
      {
        name: 'Mitre 10',
        type: 'hardware',
        url: 'https://www.mitre10.com.au',
        searchUrl: 'https://www.mitre10.com.au/search?text=',
        description: 'NT presence with remote delivery capability.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 3.9
      },
      {
        name: 'NT Link',
        type: 'wholesale',
        url: 'https://www.ntlink.com.au',
        searchUrl: 'https://www.ntlink.com.au/search/',
        description: 'Darwin-based building supplies. Specializes in tropical building materials.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'Total Tools',
        type: 'specialist',
        url: 'https://www.totaltools.com.au',
        searchUrl: 'https://www.totaltools.com.au/search?q=',
        description: 'Professional tools with NT delivery service.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.4
      },
      {
        name: 'Reece Plumbing',
        type: 'specialist',
        url: 'https://www.reece.com.au',
        searchUrl: 'https://www.reece.com.au/search?q=',
        description: 'NT plumbing supplies with Darwin branch.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      }
    ]
  },
  {
    state: 'ACT',
    stateName: 'Australian Capital Territory',
    suppliers: [
      {
        name: 'Bunnings Warehouse',
        type: 'hardware',
        url: 'https://www.bunnings.com.au',
        searchUrl: 'https://www.bunnings.com.au/search/products?q=',
        description: 'Multiple Canberra locations with trade centers.',
        priceLevel: 'budget',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.2
      },
      {
        name: 'Mitre 10',
        type: 'hardware',
        url: 'https://www.mitre10.com.au',
        searchUrl: 'https://www.mitre10.com.au/search?text=',
        description: 'ACT stores with local knowledge and service.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.0
      },
      {
        name: 'HardwareXpress',
        type: 'wholesale',
        url: 'https://www.hardwarexpress.com.au',
        searchUrl: 'https://www.hardwarexpress.com.au/search/',
        description: 'Canberra trade hardware specialist with competitive pricing.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.1
      },
      {
        name: 'Total Tools',
        type: 'specialist',
        url: 'https://www.totaltools.com.au',
        searchUrl: 'https://www.totaltools.com.au/search?q=',
        description: 'Canberra location with full professional range.',
        priceLevel: 'premium',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.5
      },
      {
        name: 'Reece Plumbing',
        type: 'specialist',
        url: 'https://www.reece.com.au',
        searchUrl: 'https://www.reece.com.au/search?q=',
        description: 'ACT plumbing and bathroom supplies.',
        priceLevel: 'mid-range',
        tradeDiscount: true,
        deliveryAvailable: true,
        rating: 4.4
      }
    ]
  }
];

// Helper functions
export const getSuppliersByState = (state: AustralianState): Supplier[] => {
  const stateData = SUPPLIER_DATABASE.find(s => s.state === state);
  return stateData?.suppliers || [];
};

export const getTopSuppliers = (state: AustralianState, limit: number = 5): Supplier[] => {
  const suppliers = getSuppliersByState(state);
  return suppliers
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
};

export const searchSupplierProducts = (state: AustralianState, searchTerm: string): { supplier: Supplier; searchUrl: string }[] => {
  const suppliers = getSuppliersByState(state);
  return suppliers.map(supplier => ({
    supplier,
    searchUrl: `${supplier.searchUrl}${encodeURIComponent(searchTerm)}`
  }));
};

export const getSuppliersByType = (state: AustralianState, type: Supplier['type']): Supplier[] => {
  const suppliers = getSuppliersByState(state);
  return suppliers.filter(s => s.type === type);
};
