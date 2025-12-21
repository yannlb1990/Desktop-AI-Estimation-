// Comprehensive Australian Building Materials Database
// Market pricing as of 2025 - NSW market rates

export interface MaterialItem {
  category: string;
  subcategory: string;
  name: string;
  unit: string;
  priceRange: string;
  avgPrice: number;
  suppliers: string[];
  description: string;
}

export const AUSTRALIAN_MATERIALS: MaterialItem[] = [
  // TIMBER & FRAMING
  { category: "Timber", subcategory: "Structural", name: "MGP10 90x45mm Pine", unit: "lm", priceRange: "$3.20-$4.50", avgPrice: 3.85, suppliers: ["Bunnings", "Mitre 10"], description: "Standard structural pine framing" },
  { category: "Timber", subcategory: "Structural", name: "MGP12 90x45mm Pine", unit: "lm", priceRange: "$4.50-$6.20", avgPrice: 5.35, suppliers: ["Bunnings", "Mitre 10"], description: "Higher grade structural pine" },
  { category: "Timber", subcategory: "Treated", name: "H2 90x45mm Treated Pine", unit: "lm", priceRange: "$4.80-$6.50", avgPrice: 5.65, suppliers: ["Bunnings", "Mitre 10"], description: "Interior treated framing" },
  { category: "Timber", subcategory: "Treated", name: "H3 90x45mm Treated Pine", unit: "lm", priceRange: "$6.20-$8.40", avgPrice: 7.30, suppliers: ["Bunnings", "Mitre 10"], description: "Exterior treated framing" },
  { category: "Timber", subcategory: "Engineered", name: "LVL 240x45mm Hyne", unit: "lm", priceRange: "$18.50-$24.00", avgPrice: 21.25, suppliers: ["Bunnings", "Timber Plus"], description: "Laminated veneer lumber beam" },
  { category: "Timber", subcategory: "Sheet", name: "17mm Structural Plywood", unit: "sheet", priceRange: "$52.00-$68.00", avgPrice: 60.00, suppliers: ["Bunnings", "Mitre 10"], description: "2400x1200mm plywood sheet" },
  { category: "Timber", subcategory: "Sheet", name: "12mm Structural Plywood", unit: "sheet", priceRange: "$38.00-$48.00", avgPrice: 43.00, suppliers: ["Bunnings", "Mitre 10"], description: "2400x1200mm plywood sheet" },
  { category: "Timber", subcategory: "Decking", name: "90x22mm Merbau Decking", unit: "lm", priceRange: "$12.50-$16.80", avgPrice: 14.65, suppliers: ["Bunnings", "Mitre 10"], description: "Hardwood decking boards" },
  { category: "Timber", subcategory: "Decking", name: "140x19mm Treated Pine Decking", unit: "lm", priceRange: "$5.80-$7.50", avgPrice: 6.65, suppliers: ["Bunnings", "Mitre 10"], description: "Standard pine decking" },

  // FASTENERS
  { category: "Fasteners", subcategory: "Screws", name: "8g x 50mm Timber Screws", unit: "box (500)", priceRange: "$12.00-$18.00", avgPrice: 15.00, suppliers: ["Bunnings", "Total Tools"], description: "Chipboard timber screws" },
  { category: "Fasteners", subcategory: "Screws", name: "10g x 75mm Timber Screws", unit: "box (200)", priceRange: "$14.00-$22.00", avgPrice: 18.00, suppliers: ["Bunnings", "Total Tools"], description: "Heavy duty timber screws" },
  { category: "Fasteners", subcategory: "Screws", name: "6g x 25mm Drywall Screws", unit: "box (1000)", priceRange: "$8.00-$15.00", avgPrice: 11.50, suppliers: ["Bunnings", "Total Tools"], description: "Plasterboard screws" },
  { category: "Fasteners", subcategory: "Screws", name: "10-16 x 50mm Tek Screws", unit: "box (100)", priceRange: "$18.00-$28.00", avgPrice: 23.00, suppliers: ["Bunnings", "Total Tools"], description: "Self-drilling metal screws" },
  { category: "Fasteners", subcategory: "Nails", name: "75mm Bullet Head Nails", unit: "kg", priceRange: "$6.50-$9.50", avgPrice: 8.00, suppliers: ["Bunnings", "Mitre 10"], description: "Framing nails" },
  { category: "Fasteners", subcategory: "Nails", name: "50mm Galv Clout Nails", unit: "kg", priceRange: "$5.20-$7.80", avgPrice: 6.50, suppliers: ["Bunnings", "Mitre 10"], description: "Roofing nails" },
  { category: "Fasteners", subcategory: "Anchors", name: "M10 x 100mm Dynabolt", unit: "box (10)", priceRange: "$18.00-$26.00", avgPrice: 22.00, suppliers: ["Bunnings", "Total Tools"], description: "Concrete anchor bolts" },
  { category: "Fasteners", subcategory: "Anchors", name: "M8 x 75mm Chemset", unit: "box (10)", priceRange: "$24.00-$35.00", avgPrice: 29.50, suppliers: ["Bunnings", "Total Tools"], description: "Chemical anchor system" },

  // PLASTERBOARD & LINING
  { category: "Plasterboard", subcategory: "Standard", name: "10mm Standard Plasterboard", unit: "sheet", priceRange: "$16.00-$22.00", avgPrice: 19.00, suppliers: ["Bunnings", "Reece"], description: "2400x1200mm standard sheet" },
  { category: "Plasterboard", subcategory: "Standard", name: "13mm Standard Plasterboard", unit: "sheet", priceRange: "$18.50-$25.00", avgPrice: 21.75, suppliers: ["Bunnings", "Reece"], description: "2400x1200mm standard sheet" },
  { category: "Plasterboard", subcategory: "Wet Area", name: "13mm Blue Board (Wet Area)", unit: "sheet", priceRange: "$28.00-$38.00", avgPrice: 33.00, suppliers: ["Bunnings", "Reece"], description: "Moisture resistant board" },
  { category: "Plasterboard", subcategory: "Fire Rated", name: "13mm Fire Rated Plasterboard", unit: "sheet", priceRange: "$32.00-$44.00", avgPrice: 38.00, suppliers: ["Bunnings", "Reece"], description: "60min fire rating" },
  { category: "Plasterboard", subcategory: "Accessories", name: "Base Coat Compound 20kg", unit: "bag", priceRange: "$18.00-$26.00", avgPrice: 22.00, suppliers: ["Bunnings", "Reece"], description: "Base coat plaster" },
  { category: "Plasterboard", subcategory: "Accessories", name: "Top Coat Compound 20kg", unit: "bag", priceRange: "$20.00-$28.00", avgPrice: 24.00, suppliers: ["Bunnings", "Reece"], description: "Finishing compound" },
  { category: "Plasterboard", subcategory: "Accessories", name: "Paper Jointing Tape 75mm", unit: "roll", priceRange: "$5.00-$8.00", avgPrice: 6.50, suppliers: ["Bunnings", "Reece"], description: "Paper tape 150m roll" },

  // INSULATION
  { category: "Insulation", subcategory: "Batts", name: "R2.5 Ceiling Batts 430mm", unit: "pack (8.65m²)", priceRange: "$42.00-$58.00", avgPrice: 50.00, suppliers: ["Bunnings", "Mitre 10"], description: "Standard ceiling insulation" },
  { category: "Insulation", subcategory: "Batts", name: "R4.0 Ceiling Batts 430mm", unit: "pack (6.95m²)", priceRange: "$58.00-$78.00", avgPrice: 68.00, suppliers: ["Bunnings", "Mitre 10"], description: "High performance ceiling" },
  { category: "Insulation", subcategory: "Batts", name: "R2.0 Wall Batts 90mm", unit: "pack (10.03m²)", priceRange: "$38.00-$52.00", avgPrice: 45.00, suppliers: ["Bunnings", "Mitre 10"], description: "Standard wall insulation" },
  { category: "Insulation", subcategory: "Blanket", name: "R1.5 Foil Blanket", unit: "roll (20m²)", priceRange: "$85.00-$115.00", avgPrice: 100.00, suppliers: ["Bunnings", "Mitre 10"], description: "Reflective foil insulation" },
  
  // PLUMBING
  { category: "Plumbing", subcategory: "Copper", name: "15mm Type B Copper Pipe", unit: "m", priceRange: "$12.00-$18.00", avgPrice: 15.00, suppliers: ["Reece", "Tradelink"], description: "Standard copper water pipe" },
  { category: "Plumbing", subcategory: "Copper", name: "22mm Type B Copper Pipe", unit: "m", priceRange: "$18.00-$26.00", avgPrice: 22.00, suppliers: ["Reece", "Tradelink"], description: "Larger copper water pipe" },
  { category: "Plumbing", subcategory: "PVC", name: "100mm PVC DWV Pipe", unit: "m", priceRange: "$8.00-$12.00", avgPrice: 10.00, suppliers: ["Bunnings", "Reece"], description: "Drain waste vent pipe" },
  { category: "Plumbing", subcategory: "PVC", name: "50mm PVC DWV Pipe", unit: "m", priceRange: "$4.50-$7.00", avgPrice: 5.75, suppliers: ["Bunnings", "Reece"], description: "Drain waste vent pipe" },
  { category: "Plumbing", subcategory: "PEX", name: "20mm PEX-A Pipe", unit: "m", priceRange: "$3.80-$5.50", avgPrice: 4.65, suppliers: ["Reece", "Tradelink"], description: "Flexible water pipe" },
  { category: "Plumbing", subcategory: "Fittings", name: "15mm Copper Elbow", unit: "ea", priceRange: "$2.80-$4.20", avgPrice: 3.50, suppliers: ["Reece", "Tradelink"], description: "90° copper elbow" },
  { category: "Plumbing", subcategory: "Fixtures", name: "Standard Toilet Suite", unit: "ea", priceRange: "$280.00-$450.00", avgPrice: 365.00, suppliers: ["Reece", "Bunnings"], description: "Wall faced toilet" },
  { category: "Plumbing", subcategory: "Fixtures", name: "Basin Mixer Tap", unit: "ea", priceRange: "$95.00-$185.00", avgPrice: 140.00, suppliers: ["Reece", "Bunnings"], description: "Chrome basin mixer" },

  // ELECTRICAL
  { category: "Electrical", subcategory: "Cable", name: "2.5mm² TPS Cable", unit: "m", priceRange: "$2.80-$4.20", avgPrice: 3.50, suppliers: ["Bunnings", "Total Tools"], description: "Twin + earth cable" },
  { category: "Electrical", subcategory: "Cable", name: "6mm² TPS Cable", unit: "m", priceRange: "$6.50-$9.80", avgPrice: 8.15, suppliers: ["Bunnings", "Total Tools"], description: "Heavy duty cable" },
  { category: "Electrical", subcategory: "Conduit", name: "20mm PVC Conduit", unit: "m", priceRange: "$1.80-$2.80", avgPrice: 2.30, suppliers: ["Bunnings", "Total Tools"], description: "Electrical conduit" },
  { category: "Electrical", subcategory: "Switches", name: "Single Gang Switch", unit: "ea", priceRange: "$3.50-$6.50", avgPrice: 5.00, suppliers: ["Bunnings", "Total Tools"], description: "Single light switch" },
  { category: "Electrical", subcategory: "Outlets", name: "Double GPO", unit: "ea", priceRange: "$4.50-$8.50", avgPrice: 6.50, suppliers: ["Bunnings", "Total Tools"], description: "Double power outlet" },
  { category: "Electrical", subcategory: "Protection", name: "RCD Safety Switch", unit: "ea", priceRange: "$75.00-$120.00", avgPrice: 97.50, suppliers: ["Bunnings", "Total Tools"], description: "Residual current device" },

  // CONCRETE & MASONRY
  { category: "Concrete", subcategory: "Premix", name: "20MPa Premix Concrete", unit: "m³", priceRange: "$180.00-$240.00", avgPrice: 210.00, suppliers: ["Boral", "Hanson"], description: "Standard strength concrete" },
  { category: "Concrete", subcategory: "Premix", name: "32MPa Premix Concrete", unit: "m³", priceRange: "$220.00-$280.00", avgPrice: 250.00, suppliers: ["Boral", "Hanson"], description: "High strength concrete" },
  { category: "Concrete", subcategory: "Reinforcement", name: "N12 (12mm) Rebar", unit: "m", priceRange: "$2.80-$4.20", avgPrice: 3.50, suppliers: ["Bunnings", "Steel suppliers"], description: "Deformed reinforcing bar" },
  { category: "Concrete", subcategory: "Reinforcement", name: "SL92 Mesh 6x2.4m", unit: "sheet", priceRange: "$58.00-$78.00", avgPrice: 68.00, suppliers: ["Bunnings", "Steel suppliers"], description: "Welded wire mesh" },
  { category: "Concrete", subcategory: "Blocks", name: "200mm Concrete Block", unit: "ea", priceRange: "$3.20-$4.80", avgPrice: 4.00, suppliers: ["Bunnings", "Mitre 10"], description: "Standard concrete block" },
  { category: "Concrete", subcategory: "Bricks", name: "Standard Clay Brick", unit: "ea", priceRange: "$0.90-$1.40", avgPrice: 1.15, suppliers: ["Brickworks", "Bunnings"], description: "Common red brick" },

  // ROOFING
  { category: "Roofing", subcategory: "Metal", name: "Colorbond Corrugated 0.42mm", unit: "m²", priceRange: "$18.00-$26.00", avgPrice: 22.00, suppliers: ["Bunnings", "Roofing suppliers"], description: "Steel roofing sheets" },
  { category: "Roofing", subcategory: "Metal", name: "Trimdek 0.48mm", unit: "m²", priceRange: "$22.00-$32.00", avgPrice: 27.00, suppliers: ["Bunnings", "Roofing suppliers"], description: "Heavy duty roofing" },
  { category: "Roofing", subcategory: "Tiles", name: "Terracotta Roof Tiles", unit: "m²", priceRange: "$45.00-$65.00", avgPrice: 55.00, suppliers: ["Roof tile suppliers"], description: "Clay roof tiles" },
  { category: "Roofing", subcategory: "Tiles", name: "Concrete Roof Tiles", unit: "m²", priceRange: "$32.00-$48.00", avgPrice: 40.00, suppliers: ["Bunnings", "Roof tile suppliers"], description: "Concrete roof tiles" },
  { category: "Roofing", subcategory: "Sarking", name: "Roof Sarking Sisalation", unit: "m²", priceRange: "$2.80-$4.20", avgPrice: 3.50, suppliers: ["Bunnings", "Mitre 10"], description: "Reflective roof underlay" },
  { category: "Roofing", subcategory: "Battens", name: "38x25mm Treated Batten", unit: "lm", priceRange: "$1.20-$1.80", avgPrice: 1.50, suppliers: ["Bunnings", "Mitre 10"], description: "Roofing timber battens" },

  // CLADDING
  { category: "Cladding", subcategory: "Weatherboard", name: "180x19mm Treated Pine Board", unit: "lm", priceRange: "$4.50-$6.80", avgPrice: 5.65, suppliers: ["Bunnings", "Mitre 10"], description: "External weatherboard" },
  { category: "Cladding", subcategory: "FC Sheet", name: "Hardie FC Sheet 2400x1200", unit: "sheet", priceRange: "$28.00-$38.00", avgPrice: 33.00, suppliers: ["Bunnings", "Mitre 10"], description: "Fibre cement sheet" },
  { category: "Cladding", subcategory: "FC Sheet", name: "Hardie Plank 3600x180mm", unit: "sheet", priceRange: "$24.00-$34.00", avgPrice: 29.00, suppliers: ["Bunnings", "Mitre 10"], description: "Fibre cement plank" },
  { category: "Cladding", subcategory: "Brick Veneer", name: "Face Brick Supply", unit: "ea", priceRange: "$1.20-$2.00", avgPrice: 1.60, suppliers: ["Brickworks"], description: "Exterior face brick" },

  // FLOORING
  { category: "Flooring", subcategory: "Tiles", name: "600x600mm Porcelain Tiles", unit: "m²", priceRange: "$28.00-$45.00", avgPrice: 36.50, suppliers: ["Bunnings", "Tile suppliers"], description: "Floor tiles" },
  { category: "Flooring", subcategory: "Tiles", name: "Tile Adhesive 20kg", unit: "bag", priceRange: "$18.00-$28.00", avgPrice: 23.00, suppliers: ["Bunnings", "Mitre 10"], description: "Flexible tile adhesive" },
  { category: "Flooring", subcategory: "Tiles", name: "Tile Grout 5kg", unit: "bag", priceRange: "$12.00-$18.00", avgPrice: 15.00, suppliers: ["Bunnings", "Mitre 10"], description: "Tile grout various colors" },
  { category: "Flooring", subcategory: "Timber", name: "Blackbutt Tongue & Groove 80mm", unit: "m²", priceRange: "$55.00-$75.00", avgPrice: 65.00, suppliers: ["Timber suppliers"], description: "Hardwood flooring" },
  { category: "Flooring", subcategory: "Vinyl", name: "Luxury Vinyl Plank", unit: "m²", priceRange: "$35.00-$55.00", avgPrice: 45.00, suppliers: ["Bunnings", "Flooring specialists"], description: "LVP flooring" },

  // PAINT & FINISHES
  { category: "Paint", subcategory: "Interior", name: "Dulux Wash & Wear 10L", unit: "bucket", priceRange: "$95.00-$125.00", avgPrice: 110.00, suppliers: ["Bunnings", "Paint suppliers"], description: "Interior low sheen paint" },
  { category: "Paint", subcategory: "Interior", name: "Ceiling White 15L", unit: "bucket", priceRange: "$65.00-$85.00", avgPrice: 75.00, suppliers: ["Bunnings", "Paint suppliers"], description: "Flat white ceiling paint" },
  { category: "Paint", subcategory: "Exterior", name: "Dulux Weathershield 10L", unit: "bucket", priceRange: "$110.00-$145.00", avgPrice: 127.50, suppliers: ["Bunnings", "Paint suppliers"], description: "Exterior low sheen" },
  { category: "Paint", subcategory: "Primer", name: "Undercoat Sealer 10L", unit: "bucket", priceRange: "$75.00-$95.00", avgPrice: 85.00, suppliers: ["Bunnings", "Paint suppliers"], description: "Interior/exterior primer" },
];

// Helper functions
export const getMaterialsByCategory = (category: string) => {
  return AUSTRALIAN_MATERIALS.filter(m => m.category === category);
};

export const searchMaterials = (searchTerm: string) => {
  const term = searchTerm.toLowerCase();
  return AUSTRALIAN_MATERIALS.filter(m => 
    m.name.toLowerCase().includes(term) || 
    m.category.toLowerCase().includes(term) ||
    m.description.toLowerCase().includes(term)
  );
};

export const getMaterialCategories = () => {
  return [...new Set(AUSTRALIAN_MATERIALS.map(m => m.category))];
};