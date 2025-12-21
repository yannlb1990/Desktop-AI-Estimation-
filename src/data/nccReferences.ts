// Comprehensive NCC (National Construction Code) References Database
// Updated for NCC 2025 - Australian Building Standards

export interface NCCReference {
  id: string;
  section: string;
  title: string;
  keywords: string[];
  description: string;
  url: string;
  category: string;
}

export const NCC_REFERENCES: NCCReference[] = [
  // SECTION A - GOVERNING REQUIREMENTS
  {
    id: "A1.1",
    section: "Part A1.1",
    title: "Scope and Application",
    keywords: ["scope", "application", "building", "classification"],
    description: "General requirements for NCC compliance and building classifications",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-a-governing-requirements/section-a-scope-and-application",
    category: "Governing Requirements"
  },
  {
    id: "A2.2",
    section: "Part A2.2",
    title: "Building Classification",
    keywords: ["class", "classification", "use", "type"],
    description: "Building classifications from Class 1 to Class 10",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-a-governing-requirements/section-a-classification-buildings",
    category: "Governing Requirements"
  },

  // SECTION B - STRUCTURE
  {
    id: "B1.2",
    section: "Part B1.2",
    title: "Structural Resistance and Stability",
    keywords: ["structure", "structural", "loads", "resistance", "stability", "foundations", "footings"],
    description: "Requirements for structural adequacy, loadings, and resistance to actions",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },
  {
    id: "B1.4",
    section: "Part B1.4",
    title: "Earthquake Design Category",
    keywords: ["earthquake", "seismic", "zone", "bracing"],
    description: "Earthquake design requirements based on location",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },
  {
    id: "B2.2",
    section: "Part B2.2",
    title: "Resistance to Moisture",
    keywords: ["damp", "moisture", "waterproofing", "dampproofing", "water penetration"],
    description: "Protection against dampness and moisture penetration",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },
  {
    id: "B2.3",
    section: "Part B2.3",
    title: "Wet Areas",
    keywords: ["wet area", "bathroom", "shower", "waterproofing", "membrane"],
    description: "Waterproofing requirements for bathrooms, showers, and laundries",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },

  // SECTION C - FIRE RESISTANCE
  {
    id: "C1.1",
    section: "Part C1.1",
    title: "Fire Resistance Levels (FRL)",
    keywords: ["fire", "FRL", "fire rating", "fire resistance", "fire walls"],
    description: "Fire resistance requirements for building elements",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-c-fire-resistance/section-c-fire-resistance",
    category: "Fire Safety"
  },
  {
    id: "C2.5",
    section: "Part C2.5",
    title: "Smoke Alarms",
    keywords: ["smoke alarm", "smoke detector", "fire alarm", "alarm"],
    description: "Smoke alarm installation requirements for dwellings",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-c-fire-resistance/section-c-fire-resistance",
    category: "Fire Safety"
  },
  {
    id: "C3.4",
    section: "Part C3.4",
    title: "Bushfire Attack Level (BAL)",
    keywords: ["bushfire", "BAL", "fire zone", "bushfire zone", "wildfire"],
    description: "Construction requirements for bushfire-prone areas",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-c-fire-resistance/section-c-fire-resistance",
    category: "Fire Safety"
  },

  // SECTION D - ACCESS AND EGRESS
  {
    id: "D2.13",
    section: "Part D2.13",
    title: "Stairways and Ramps",
    keywords: ["stairs", "stairway", "ramp", "handrail", "balustrade", "rise", "tread"],
    description: "Design requirements for stairs, ramps, and handrails",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-d-access-and-egress/section-d-access-egress",
    category: "Access & Egress"
  },
  {
    id: "D2.14",
    section: "Part D2.14",
    title: "Balustrades",
    keywords: ["balustrade", "barrier", "guard", "fall protection", "balcony"],
    description: "Barrier requirements to prevent falls",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-d-access-and-egress/section-d-access-egress",
    category: "Access & Egress"
  },
  {
    id: "D2.21",
    section: "Part D2.21",
    title: "Doorways and Doors",
    keywords: ["door", "doorway", "door width", "opening", "clearance"],
    description: "Minimum door widths and clearances",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-d-access-and-egress/section-d-access-egress",
    category: "Access & Egress"
  },
  {
    id: "D3.3",
    section: "Part D3.3",
    title: "Accessible Paths of Travel",
    keywords: ["accessibility", "disabled", "wheelchair", "access", "DDA"],
    description: "Accessible path requirements for people with disabilities",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-d-access-and-egress/section-d-access-egress",
    category: "Access & Egress"
  },

  // SECTION F - HEALTH AND AMENITY
  {
    id: "F2.2",
    section: "Part F2.2",
    title: "Natural Light",
    keywords: ["light", "lighting", "natural light", "window", "glazing", "daylight"],
    description: "Natural lighting requirements for habitable rooms",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-f-health-amenity/section-f-health-amenity",
    category: "Health & Amenity"
  },
  {
    id: "F4.5",
    section: "Part F4.5",
    title: "Ventilation",
    keywords: ["ventilation", "air", "exhaust", "fan", "fresh air", "airflow"],
    description: "Ventilation requirements for habitable rooms and wet areas",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-f-health-amenity/section-f-health-amenity",
    category: "Health & Amenity"
  },
  {
    id: "F5.2",
    section: "Part F5.2",
    title: "Sound Transmission and Insulation",
    keywords: ["acoustic", "sound", "noise", "soundproofing", "insulation", "sound rating"],
    description: "Sound insulation requirements between dwellings",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-f-health-amenity/section-f-health-amenity",
    category: "Health & Amenity"
  },
  {
    id: "F6.2",
    section: "Part F6.2",
    title: "Ceiling Height",
    keywords: ["ceiling", "height", "ceiling height", "habitable room"],
    description: "Minimum ceiling heights for habitable and non-habitable rooms",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-f-health-amenity/section-f-health-amenity",
    category: "Health & Amenity"
  },

  // SECTION G - ANCILLARY PROVISIONS
  {
    id: "G3.2",
    section: "Part G3.2",
    title: "Garage Doors",
    keywords: ["garage", "garage door", "door", "vehicle"],
    description: "Requirements for garage and vehicular access doors",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-g-ancillary-provisions/section-g-ancillary-provisions",
    category: "Ancillary"
  },

  // SECTION H - SPECIAL USE BUILDINGS
  {
    id: "H4.2",
    section: "Part H4.2",
    title: "Swimming Pools",
    keywords: ["pool", "swimming pool", "pool fence", "barrier", "pool safety"],
    description: "Safety barriers for swimming pools",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-h-special-use/section-h-special-use",
    category: "Special Use"
  },

  // SECTION J - ENERGY EFFICIENCY
  {
    id: "J1.2",
    section: "Part J1.2",
    title: "Building Fabric - Insulation",
    keywords: ["insulation", "thermal", "R-value", "energy", "efficiency", "energy rating"],
    description: "Thermal insulation requirements for building fabric",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-j-energy-efficiency/section-j-energy-efficiency",
    category: "Energy Efficiency"
  },
  {
    id: "J1.5",
    section: "Part J1.5",
    title: "Glazing and Windows",
    keywords: ["window", "glazing", "glass", "double glazing", "SHGC", "U-value"],
    description: "Energy efficiency requirements for windows and glazing",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-j-energy-efficiency/section-j-energy-efficiency",
    category: "Energy Efficiency"
  },
  {
    id: "J1.6",
    section: "Part J1.6",
    title: "Building Sealing",
    keywords: ["sealing", "air leakage", "draft", "airtight", "gaps"],
    description: "Building sealing and air leakage requirements",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-j-energy-efficiency/section-j-energy-efficiency",
    category: "Energy Efficiency"
  },
  {
    id: "J3.2",
    section: "Part J3.2",
    title: "Star Rating Requirements",
    keywords: ["star", "star rating", "NatHERS", "energy rating", "6 star", "7 star"],
    description: "Energy star rating requirements for new dwellings",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-j-energy-efficiency/section-j-energy-efficiency",
    category: "Energy Efficiency"
  },
  {
    id: "J5.2",
    section: "Part J5.2",
    title: "Hot Water Systems",
    keywords: ["hot water", "water heater", "solar", "heat pump"],
    description: "Energy efficiency for hot water systems",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-j-energy-efficiency/section-j-energy-efficiency",
    category: "Energy Efficiency"
  },

  // PLUMBING CODE - SECTION A
  {
    id: "PCA1.3",
    section: "Plumbing Code Part A1.3",
    title: "Water Supply",
    keywords: ["water", "water supply", "plumbing", "pipe", "connection"],
    description: "Water supply system requirements",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-three/plumbing-code",
    category: "Plumbing"
  },
  {
    id: "PCA2.2",
    section: "Plumbing Code Part A2.2",
    title: "Sanitary Drainage",
    keywords: ["drainage", "sewer", "sanitary", "waste", "drain"],
    description: "Sanitary drainage and sewerage requirements",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-three/plumbing-code",
    category: "Plumbing"
  },
  {
    id: "PCA3.1",
    section: "Plumbing Code Part A3.1",
    title: "Stormwater Drainage",
    keywords: ["stormwater", "storm", "drainage", "gutter", "downpipe", "rainwater"],
    description: "Stormwater drainage system requirements",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-three/plumbing-code",
    category: "Plumbing"
  },
  {
    id: "PCB1.2",
    section: "Plumbing Code Part B1.2",
    title: "Greywater Systems",
    keywords: ["greywater", "grey water", "recycled", "reuse"],
    description: "Greywater treatment and reuse systems",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-three/plumbing-code",
    category: "Plumbing"
  },
  {
    id: "PCB2.3",
    section: "Plumbing Code Part B2.3",
    title: "Rainwater Tanks",
    keywords: ["rainwater", "water tank", "tank", "storage"],
    description: "Rainwater harvesting and storage requirements",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-three/plumbing-code",
    category: "Plumbing"
  },

  // ROOFING AND EXTERNAL
  {
    id: "B1.3-Roof",
    section: "Part B1.3",
    title: "Roof and Wall Cladding",
    keywords: ["roof", "roofing", "cladding", "tiles", "colorbond", "membrane"],
    description: "Requirements for roof and wall cladding systems",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },
  {
    id: "B1.5-Gutter",
    section: "Part B1.5",
    title: "Gutters and Downpipes",
    keywords: ["gutter", "downpipe", "downspout", "rainwater"],
    description: "Gutter and downpipe sizing and installation",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },

  // FRAMING SPECIFICS
  {
    id: "B1.2-Frame",
    section: "Part B1.2",
    title: "Wall and Floor Framing",
    keywords: ["framing", "frame", "stud", "joist", "bearer", "timber", "steel"],
    description: "Wall and floor framing requirements and loadings",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },
  {
    id: "B1.2-Bracing",
    section: "Part B1.2",
    title: "Wall Bracing",
    keywords: ["bracing", "racking", "lateral", "wind"],
    description: "Wall bracing for wind and racking resistance",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },

  // ELECTRICAL (Referenced)
  {
    id: "AS3000",
    section: "AS/NZS 3000:2018",
    title: "Electrical Wiring Rules",
    keywords: ["electrical", "wiring", "power", "switch", "switchboard", "RCD"],
    description: "Australian electrical installation standards",
    url: "https://www.standards.org.au/",
    category: "Electrical"
  },

  // TERMITE PROTECTION
  {
    id: "B1.3-Termite",
    section: "Part B1.3",
    title: "Termite Risk Management",
    keywords: ["termite", "white ant", "pest", "barrier", "treated timber"],
    description: "Protection against subterranean termite entry",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },

  // GENERAL CONSTRUCTION
  {
    id: "General",
    section: "General Construction",
    title: "Construction Standards",
    keywords: ["construction", "building", "standard", "workmanship"],
    description: "General construction and workmanship standards",
    url: "https://ncc.abcb.gov.au/",
    category: "General"
  },

  // CONDENSATION
  {
    id: "F7.2",
    section: "Part F7.2",
    title: "Condensation Management",
    keywords: ["condensation", "moisture", "vapor", "vapour barrier", "sarking"],
    description: "Managing condensation in roof and wall spaces",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-f-health-amenity/section-f-health-amenity",
    category: "Health & Amenity"
  },

  // GLAZING SAFETY
  {
    id: "D2.20",
    section: "Part D2.20",
    title: "Glazing in Hazardous Locations",
    keywords: ["glass", "glazing", "safety glass", "laminated", "tempered"],
    description: "Safety glazing requirements near doors, baths, and low heights",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-d-access-and-egress/section-d-access-egress",
    category: "Access & Egress"
  },

  // FALL PROTECTION
  {
    id: "D2.15",
    section: "Part D2.15",
    title: "Openings in Floors",
    keywords: ["opening", "hole", "floor opening", "protection"],
    description: "Protection of openings in floors and roofs",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-d-access-and-egress/section-d-access-egress",
    category: "Access & Egress"
  },

  // EXTERNAL WALLS
  {
    id: "B2.4",
    section: "Part B2.4",
    title: "External Walls",
    keywords: ["external wall", "cladding", "weatherproofing", "render"],
    description: "External wall construction and weather resistance",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },

  // SITE PREPARATION
  {
    id: "B1.1",
    section: "Part B1.1",
    title: "Site Preparation",
    keywords: ["site", "excavation", "fill", "compaction", "earthworks"],
    description: "Site preparation and earthworks requirements",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },

  // RETAINING WALLS
  {
    id: "B1.2-Retain",
    section: "Part B1.2",
    title: "Retaining Walls",
    keywords: ["retaining wall", "retaining", "earth", "retention"],
    description: "Structural requirements for retaining walls",
    url: "https://ncc.abcb.gov.au/editions/2025/ncc-2025-volume-one/part-b-structure/section-b-structural-provisions",
    category: "Structure"
  },
];

// Fuzzy search function with keyword matching
export function searchNCC(query: string): NCCReference[] {
  if (!query || query.trim().length < 2) return [];
  
  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  
  const scored = NCC_REFERENCES.map(ref => {
    let score = 0;
    const refText = `${ref.title} ${ref.description} ${ref.keywords.join(' ')}`.toLowerCase();
    
    // Exact title match (highest priority)
    if (ref.title.toLowerCase().includes(query.toLowerCase())) {
      score += 100;
    }
    
    // Keyword exact matches (high priority)
    ref.keywords.forEach(keyword => {
      if (searchTerms.some(term => keyword.includes(term))) {
        score += 50;
      }
    });
    
    // Partial matches in description
    searchTerms.forEach(term => {
      if (refText.includes(term)) {
        score += 10;
      }
    });
    
    // Category match
    if (ref.category.toLowerCase().includes(query.toLowerCase())) {
      score += 20;
    }
    
    return { ref, score };
  });
  
  // Return top 10 results with score > 0
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(item => item.ref);
}
