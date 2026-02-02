// Comprehensive NCC (National Construction Code) References Database
// Updated for NCC 2025 - Australian Building Standards
// Includes detailed estimation notes for construction estimators

export interface NCCReference {
  id: string;
  section: string;
  title: string;
  keywords: string[];
  description: string;
  url: string;
  category: string;
  estimationNotes?: string;
  keyRequirements?: string[];
}

export const NCC_REFERENCES: NCCReference[] = [
  // SECTION A - GOVERNING REQUIREMENTS
  {
    id: "A1.1",
    section: "Part A1.1",
    title: "Scope and Application",
    keywords: ["scope", "application", "building", "classification"],
    description: "General requirements for NCC compliance and building classifications",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-one/governing-requirements/part-a1-scope-and-general",
    category: "Governing Requirements",
    estimationNotes: "Determines which NCC volume applies to your project.\n• Class 1a (houses) & Class 10 (sheds, carports): Use Volume 2\n• Class 2-9 (apartments, commercial): Use Volume 1\n• Affects scope of works and compliance requirements",
    keyRequirements: [
      "Identify building classification before starting estimate",
      "Check if building is BCA-regulated",
      "Verify state/territory variations apply"
    ]
  },
  {
    id: "A2.2",
    section: "Part A2.2",
    title: "Building Classification",
    keywords: ["class", "classification", "use", "type"],
    description: "Building classifications from Class 1 to Class 10",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-one/governing-requirements/part-a2-acceptance/a2g1-building-classification",
    category: "Governing Requirements",
    estimationNotes: "Building class determines compliance path:\n• Class 1a: Single dwelling (house)\n• Class 1b: Boarding house ≤12 residents\n• Class 2: Apartments (sole-occupancy units)\n• Class 10a: Non-habitable (garage, shed)\n• Class 10b: Structures (fence, mast, pool)\n• Class 10c: Private bushfire shelter",
    keyRequirements: [
      "Class 1a: Standard residential requirements",
      "Class 2+: Fire compartmentation, accessibility, sprinklers may apply",
      "Class 10a: Reduced requirements - no habitation"
    ]
  },

  // SECTION B - STRUCTURE
  {
    id: "B1.2",
    section: "Part B1.2",
    title: "Structural Resistance and Stability",
    keywords: ["structure", "structural", "loads", "resistance", "stability", "foundations", "footings"],
    description: "Requirements for structural adequacy, loadings, and resistance to actions",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/2-structure/part-22-structural-provisions",
    category: "Structure",
    estimationNotes: "FOOTING DEPTHS (typical for Class M site):\n• Strip footings: 450mm deep × 300mm wide minimum\n• Pad footings: 450mm × 450mm × 450mm minimum\n• Slab edge beam: 450mm deep × 300mm wide\n• Internal stiffening beams: 300mm deep\n\nCONCRETE STRENGTH:\n• Footings: N20 or N25 (25MPa)\n• Slabs: N25 or N32 for driveways\n• Reo: F62 mesh, N12 bars for edge beams",
    keyRequirements: [
      "Soil classification required (A, S, M, H1, H2, E, P)",
      "Wind classification (N1-N6, C1-C4) affects bracing",
      "Engineer certification for Class H2, E, P sites"
    ]
  },
  {
    id: "B1.4",
    section: "Part B1.4",
    title: "Earthquake Design Category",
    keywords: ["earthquake", "seismic", "zone", "bracing"],
    description: "Earthquake design requirements based on location",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/2-structure/part-23-earthquake-areas",
    category: "Structure",
    estimationNotes: "Most of Australia is low seismic risk (EDC I).\nHigher risk areas (EDC II+) may require:\n• Additional bracing (allow 15-20% extra)\n• Tie-down connections for roof\n• Hold-down straps at openings\n• Engineering certification",
    keyRequirements: [
      "Check site hazard factor (Z value) for location",
      "EDC I: Standard construction acceptable",
      "EDC II+: Engineering design required"
    ]
  },
  {
    id: "B2.2",
    section: "Part B2.2",
    title: "Resistance to Moisture",
    keywords: ["damp", "moisture", "waterproofing", "dampproofing", "water penetration"],
    description: "Protection against dampness and moisture penetration",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/3-site-preparation/part-34-moisture-from-ground",
    category: "Structure",
    estimationNotes: "DAMPPROOFING ITEMS TO INCLUDE:\n• DPC (damp proof course): Under bottom plate, 110mm wide\n• DPM (damp proof membrane): 0.2mm poly under slab\n• Sarking/wrap: Under cladding, typically 60m²/roll\n• Flashing: At all penetrations, window/door heads\n• Weep holes: Every 1200mm in brick veneer\n\nPRICING:\n• DPC: ~$2-3/LM\n• Sarking wrap: ~$150-200/roll (60m²)",
    keyRequirements: [
      "DPC minimum 110mm wide under all bottom plates",
      "DPM lapped 200mm at joints",
      "Flashing at all wall/roof junctions"
    ]
  },
  {
    id: "B2.3",
    section: "Part B2.3",
    title: "Wet Areas",
    keywords: ["wet area", "bathroom", "shower", "waterproofing", "membrane"],
    description: "Waterproofing requirements for bathrooms, showers, and laundries",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-102-wet-area-waterproofing",
    category: "Structure",
    estimationNotes: "WATERPROOFING REQUIREMENTS (AS 3740):\n\nSHOWER:\n• Floor: Full waterproof to waste + 50mm turnup\n• Walls: 1800mm high all walls in hob-less showers\n• Walls: Min 150mm above floor level beyond shower\n\nBATHROOM:\n• Floor: Full waterproof + 100mm turnup all walls\n• Shower zone: 1800mm high on shower walls\n\nLAUNDRY:\n• Under fixtures + 150mm turnup\n\nPRICING (per m²):\n• Membrane supply + apply: $45-80/m²\n• Priming: $8-12/m²\n• Bond breaker at corners: $3-5/LM",
    keyRequirements: [
      "Shower floor must fall to waste (1:80 minimum)",
      "Membrane turn-up 150mm minimum on walls",
      "Hob-less showers: waterproof all walls to 1800mm",
      "Licensed waterproofer required - certificate needed"
    ]
  },

  // SECTION C - FIRE RESISTANCE
  {
    id: "C1.1",
    section: "Part C1.1",
    title: "Fire Resistance Levels (FRL)",
    keywords: ["fire", "FRL", "fire rating", "fire resistance", "fire walls"],
    description: "Fire resistance requirements for building elements",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/9-fire-safety/part-91-fire-resistance",
    category: "Fire Safety",
    estimationNotes: "FRL FORMAT: Structural/Integrity/Insulation (e.g., 60/60/60)\n\nCOMMON REQUIREMENTS:\n• Party walls (Class 1a attached): 60/60/60 min\n• Garage wall to house: 60/60/60\n• Between Class 2 units: 60/60/60 min\n\nMATERIALS FOR 60/60/60:\n• 2 × 13mm Fyrchek plasterboard each side\n• Or 1 × 16mm Fyrchek each side\n• Steel stud 64mm or 92mm\n\nPRICING:\n• 13mm Fyrchek: ~$28-35/sheet (2400×1200)\n• 16mm Fyrchek: ~$45-55/sheet\n• Fire rated compound: ~$35/box",
    keyRequirements: [
      "Party walls must extend to underside of roof covering",
      "All penetrations require fire collars/wraps",
      "Fire doors where required: min 30min rating",
      "Document FRL on drawings for certification"
    ]
  },
  {
    id: "C2.5",
    section: "Part C2.5",
    title: "Smoke Alarms",
    keywords: ["smoke alarm", "smoke detector", "fire alarm", "alarm"],
    description: "Smoke alarm installation requirements for dwellings",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/9-fire-safety/part-95-smoke-alarms-and-evacuation-lighting",
    category: "Fire Safety",
    estimationNotes: "SMOKE ALARM REQUIREMENTS:\n\nNEW BUILDS (from 2022):\n• Interconnected (hardwired or wireless)\n• In every bedroom\n• In hallways connecting bedrooms\n• On every storey\n\nTYPES:\n• Photoelectric type required (not ionisation)\n• 240V hardwired with battery backup preferred\n• Wireless interconnected acceptable\n\nPRICING:\n• Basic 240V smoke alarm: $40-60 each\n• Premium interconnected: $80-120 each\n• Wireless interconnected kit (6): $300-400\n• Electrician install: $50-80 per alarm",
    keyRequirements: [
      "All alarms must be interconnected",
      "Photoelectric type only",
      "Located on ceiling 300mm min from walls",
      "Battery backup required for 240V units"
    ]
  },
  {
    id: "C3.4",
    section: "Part C3.4",
    title: "Bushfire Attack Level (BAL)",
    keywords: ["bushfire", "BAL", "fire zone", "bushfire zone", "wildfire"],
    description: "Construction requirements for bushfire-prone areas",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/12-ancillary-provisions/part-125-bushfire-areas",
    category: "Fire Safety",
    estimationNotes: "BAL LEVELS & COST IMPACT:\n• BAL-LOW: No additional requirements\n• BAL-12.5: +5-8% build cost (basic protection)\n• BAL-19: +8-12% (improved glazing, gaps sealed)\n• BAL-29: +12-18% (BAL-rated windows, no vents)\n• BAL-40: +18-25% (steel frames, metal screens)\n• BAL-FZ: +25-40% (fire bunker spec)\n\nKEY ITEMS BY BAL:\n• BAL-12.5+: Ember guard to all vents, 6mm gaps max\n• BAL-19+: Tempered glass, no timber decks\n• BAL-29+: BAL-rated windows ~$800-1200 extra/window\n• BAL-40+: Fire shutters, non-combustible walls",
    keyRequirements: [
      "BAL assessment required from surveyor ($300-600)",
      "BAL affects windows, doors, cladding, decking",
      "Ember attack is primary concern - seal all gaps",
      "Certificate of compliance needed"
    ]
  },

  // SECTION D - ACCESS AND EGRESS
  {
    id: "D2.13",
    section: "Part D2.13",
    title: "Stairways and Ramps",
    keywords: ["stairs", "stairway", "ramp", "handrail", "balustrade", "rise", "tread"],
    description: "Design requirements for stairs, ramps, and handrails",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-112-stairway-and-ramp-construction",
    category: "Access & Egress",
    estimationNotes: "STAIR DIMENSIONS (Class 1a residential):\n• Riser: 115mm min, 190mm max\n• Going (tread): 240mm min, 355mm max\n• Width: 600mm min (850mm ideal)\n• Headroom: 2000mm min\n• Formula: 2R + G = 550-700mm\n\nHANDRAIL:\n• Height: 865-1000mm\n• Both sides if >1000mm wide\n• Continuous length of stair\n\nPRICING (per flight ~14 risers):\n• Timber stair kit: $2,000-4,000\n• Steel stringers + timber treads: $4,000-7,000\n• Timber handrail: $80-150/LM\n• Glass balustrade: $350-600/LM",
    keyRequirements: [
      "Risers uniform ±5mm tolerance",
      "Nosings required on closed risers",
      "Handrail graspable 30-65mm diameter",
      "Landing every 18 risers maximum"
    ]
  },
  {
    id: "D2.14",
    section: "Part D2.14",
    title: "Balustrades",
    keywords: ["balustrade", "barrier", "guard", "fall protection", "balcony"],
    description: "Barrier requirements to prevent falls",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-113-barriers-and-handrails",
    category: "Access & Egress",
    estimationNotes: "BALUSTRADE HEIGHT REQUIREMENTS:\n• >4m drop: 1000mm high (typical residential)\n• <4m drop: 865mm acceptable (internal stairs)\n• Within 500mm of climbable: 1200mm\n• Pool fencing: 1200mm min\n\nGAP REQUIREMENTS:\n• Max 125mm gaps (no 125mm sphere can pass)\n• Bottom gap: 100mm max\n• No climbable horizontal rails within 150mm\n\nPRICING (per LM):\n• Timber picket: $150-250/LM\n• Steel wire: $200-350/LM\n• Glass frameless: $500-800/LM\n• Glass semi-frameless: $350-500/LM",
    keyRequirements: [
      "Must withstand 0.6kN/m horizontal load",
      "No climbable elements between 150-760mm",
      "125mm sphere test for gaps",
      "Pool fencing has additional requirements"
    ]
  },
  {
    id: "D2.21",
    section: "Part D2.21",
    title: "Doorways and Doors",
    keywords: ["door", "doorway", "door width", "opening", "clearance"],
    description: "Minimum door widths and clearances",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-111-general",
    category: "Access & Egress",
    estimationNotes: "DOOR SIZE REQUIREMENTS:\n\nMINIMUM WIDTHS:\n• General: 720mm (820mm clear opening)\n• Accessible: 850mm door (800mm clear)\n• Bathroom access: 720mm\n• Front entry: 820mm typical\n\nHEIGHTS:\n• Standard: 2040mm\n• Minimum: 1980mm\n\nSTANDARD DOOR SIZES:\n• 720 × 2040 (internal)\n• 820 × 2040 (standard internal/access)\n• 920 × 2040 (entry doors)\n• 820 × 2340 (2400 ceiling height)\n\nPRICING:\n• Hollow core internal: $80-150\n• Solid core: $250-400\n• Entry door: $400-1500\n• Sliding door (2.4m): $800-2000",
    keyRequirements: [
      "Clear opening = door width minus 30mm",
      "Accessible doors: lever handles, low thresholds",
      "Front door: weather sealed, min 820mm",
      "Fire doors where FRL required"
    ]
  },
  {
    id: "D3.3",
    section: "Part D3.3",
    title: "Accessible Paths of Travel",
    keywords: ["accessibility", "disabled", "wheelchair", "access", "DDA"],
    description: "Accessible path requirements for people with disabilities",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-114-accessible-features",
    category: "Access & Egress",
    estimationNotes: "LIVABLE HOUSING AUSTRALIA / AS 4299:\n\nSILVER LEVEL (min new builds):\n• 850mm doorways throughout\n• 1200mm wide hallways\n• Step-free shower\n• Toilet on entry level\n• Reinforced walls in bathroom\n\nKEY DIMENSIONS:\n• Ramp gradient: 1:14 max (preferred 1:20)\n• Threshold: 5mm max (15mm bevelled)\n• Circulation: 1540mm turning space\n• Toilet side clearance: 900mm one side\n\nCOST IMPACT:\n• Silver level adds ~$5,000-10,000 to typical house\n• Wider doors, doorways main cost",
    keyRequirements: [
      "Check if Livable Housing required (state dependent)",
      "Reinforce walls for future grab rails",
      "Step-free entry to dwelling",
      "850mm doors + 1200mm corridors"
    ]
  },

  // SECTION F - HEALTH AND AMENITY
  {
    id: "F2.2",
    section: "Part F2.2",
    title: "Natural Light",
    keywords: ["light", "lighting", "natural light", "window", "glazing", "daylight"],
    description: "Natural lighting requirements for habitable rooms",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-104-light",
    category: "Health & Amenity",
    estimationNotes: "MINIMUM WINDOW AREA:\n• Habitable rooms: 10% of floor area\n• Example: 16m² room = 1.6m² window area\n• Can be reduced with borrowed light\n\nHABITABLE ROOMS INCLUDE:\n• Bedroom, living, dining, study, kitchen\n\nNOT REQUIRED:\n• Bathroom, laundry, toilet, pantry, hallway\n\nCOMMON WINDOW SIZES:\n• 600 × 600 (0.36m²) - toilet/bathroom\n• 900 × 900 (0.81m²) - kitchen\n• 1200 × 1200 (1.44m²) - bedroom\n• 2100 × 1800 (3.78m²) - living",
    keyRequirements: [
      "10% of floor area minimum for habitable rooms",
      "Windows must open to outdoors or covered area",
      "Borrowed light acceptable from adjacent rooms",
      "Skylights count towards requirement"
    ]
  },
  {
    id: "F4.5",
    section: "Part F4.5",
    title: "Ventilation",
    keywords: ["ventilation", "air", "exhaust", "fan", "fresh air", "airflow"],
    description: "Ventilation requirements for habitable rooms and wet areas",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-103-room-heights-and-ventilation",
    category: "Health & Amenity",
    estimationNotes: "NATURAL VENTILATION:\n• Habitable rooms: 5% of floor area openable\n• Kitchen: Requires exhaust over cooktop\n\nMECHANICAL VENTILATION REQUIRED:\n• Bathroom without window: 25 L/s exhaust\n• Toilet: 25 L/s exhaust\n• Laundry: 20 L/s exhaust\n• Kitchen rangehood: 50-100 L/s\n\nPRICING:\n• Bathroom exhaust fan: $80-200\n• Inline fan: $250-450\n• Rangehood: $200-1500\n• Ducting (per meter): $20-40\n• External vent cap: $30-60",
    keyRequirements: [
      "Exhaust must vent to outside (not roof space)",
      "Kitchen rangehood over every cooktop",
      "Bathroom fan: min 25 L/s if no window",
      "150mm duct minimum for exhaust fans"
    ]
  },
  {
    id: "F5.2",
    section: "Part F5.2",
    title: "Sound Transmission and Insulation",
    keywords: ["acoustic", "sound", "noise", "soundproofing", "insulation", "sound rating"],
    description: "Sound insulation requirements between dwellings",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-107-sound-insulation",
    category: "Health & Amenity",
    estimationNotes: "ACOUSTIC REQUIREMENTS (Class 2+):\n\nWALLS BETWEEN UNITS:\n• Rw + Ctr ≥ 50 (airborne sound)\n• Typical solution: Double stud with insulation\n\nFLOORS:\n• Rw + Ctr ≥ 50 (airborne)\n• Ln,w + CI ≤ 62 (impact)\n\nSOLUTIONS:\n• Acoustic batts: $8-15/m²\n• Resilient mounts: $8-12 each\n• Acoustic sealant: $15-25/tube\n• Double stud wall (with insulation): +$40-60/m²\n\nClass 1a (single dwelling):\n• No acoustic requirements between rooms",
    keyRequirements: [
      "Class 2+ dwellings: Rw 50 between units",
      "Seal all gaps, outlets, penetrations",
      "Double stud walls preferred over single",
      "Consider impact noise for upper floors"
    ]
  },
  {
    id: "F6.2",
    section: "Part F6.2",
    title: "Ceiling Height",
    keywords: ["ceiling", "height", "ceiling height", "habitable room"],
    description: "Minimum ceiling heights for habitable and non-habitable rooms",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-103-room-heights-and-ventilation",
    category: "Health & Amenity",
    estimationNotes: "MINIMUM CEILING HEIGHTS:\n\nHABITABLE ROOMS:\n• Standard: 2400mm minimum\n• Under beams: 2100mm (max 1/3 area)\n• Attic rooms: 2200mm (min 2/3 area)\n\nNON-HABITABLE ROOMS:\n• Bathroom, laundry, toilet: 2100mm\n• Corridor, hallway: 2100mm\n• Garage: 2100mm\n\nIMPLICATIONS FOR ESTIMATING:\n• 2400 ceiling = 2450mm stud (typical)\n• 2700 ceiling = 2750mm stud (~$15-20/stud extra)\n• Affects door heights, window head heights\n• Higher ceilings = more plasterboard, paint",
    keyRequirements: [
      "2400mm minimum for habitable rooms",
      "2100mm minimum for non-habitable rooms",
      "Beams can intrude up to 1/3 of ceiling area",
      "Sloping ceilings: 2200mm over 2/3 of area"
    ]
  },

  // SECTION G - ANCILLARY PROVISIONS
  {
    id: "G3.2",
    section: "Part G3.2",
    title: "Garage Doors",
    keywords: ["garage", "garage door", "door", "vehicle"],
    description: "Requirements for garage and vehicular access doors",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/12-ancillary-provisions/part-121-carports-and-garages",
    category: "Ancillary",
    estimationNotes: "GARAGE DOOR SIZES:\n• Single car: 2400-2700mm wide × 2100-2400mm high\n• Double car: 4800-5400mm wide × 2100-2400mm high\n\nTYPES & PRICING:\n• Sectional panel (steel): $1,200-2,500\n• Roller door: $800-1,800\n• Tilt door: $1,000-2,200\n• Auto opener: $350-800 additional\n\nSTRUCTURAL:\n• Lintel over opening (typically steel)\n• Allow for posts each side if wide\n• Minimum 2100mm clearance inside",
    keyRequirements: [
      "Minimum 2100mm clear height",
      "Fire rating if attached to Class 1a dwelling",
      "Self-closing device if opening to house",
      "Step-up at door into house"
    ]
  },

  // SECTION H - SPECIAL USE BUILDINGS
  {
    id: "H4.2",
    section: "Part H4.2",
    title: "Swimming Pools",
    keywords: ["pool", "swimming pool", "pool fence", "barrier", "pool safety"],
    description: "Safety barriers for swimming pools",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/12-ancillary-provisions/part-122-swimming-pool-access",
    category: "Special Use",
    estimationNotes: "POOL BARRIER REQUIREMENTS (AS 1926.1):\n\nHEIGHT & GAPS:\n• Fence height: 1200mm minimum\n• Gap under fence: 100mm max\n• Vertical gap: 100mm max\n• Horizontal rails: 900mm min apart\n\nGATE REQUIREMENTS:\n• Self-closing, self-latching\n• Latch height: 1500mm (or 1400mm with shield)\n• Opens outward from pool\n\nPRICING (per LM):\n• Tubular aluminium: $150-250/LM\n• Glass pool fence: $350-600/LM\n• Glass gate: $600-1200 each\n• Council inspection: $150-300",
    keyRequirements: [
      "1200mm high minimum (higher in some states)",
      "No climbable objects within 900mm of fence",
      "All gates self-closing and self-latching",
      "Pool safety certificate required"
    ]
  },

  // SECTION J - ENERGY EFFICIENCY
  {
    id: "J1.2",
    section: "Part J1.2",
    title: "Building Fabric - Insulation",
    keywords: ["insulation", "thermal", "R-value", "energy", "efficiency", "energy rating"],
    description: "Thermal insulation requirements for building fabric",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/13-energy-efficiency/part-132-building-fabric",
    category: "Energy Efficiency",
    estimationNotes: "MINIMUM R-VALUES BY CLIMATE ZONE:\n\nCEILING (most common):\n• Zone 2-3 (QLD coast): R4.1\n• Zone 4-5 (Sydney, Perth): R4.1\n• Zone 6 (Adelaide, Melbourne): R5.1\n• Zone 7-8 (Hobart, alpine): R6.3\n\nWALLS:\n• Zone 2-5: R2.0-2.5 total\n• Zone 6-8: R2.5-3.0 total\n\nFLOOR (if suspended):\n• Zone 4-8: R2.0-2.5\n\nPRICING (supply only):\n• R2.5 wall batts: $8-12/m²\n• R4.0 ceiling batts: $12-18/m²\n• R5.0 ceiling batts: $16-24/m²\n• R6.0 ceiling batts: $22-30/m²",
    keyRequirements: [
      "Climate zone determines R-value requirements",
      "Ceiling insulation is most critical",
      "No gaps or compression in insulation",
      "Vapour barriers may be required (climate dependent)"
    ]
  },
  {
    id: "J1.5",
    section: "Part J1.5",
    title: "Glazing and Windows",
    keywords: ["window", "glazing", "glass", "double glazing", "SHGC", "U-value"],
    description: "Energy efficiency requirements for windows and glazing",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/13-energy-efficiency/part-133-glazing",
    category: "Energy Efficiency",
    estimationNotes: "GLAZING REQUIREMENTS:\n\nKEY METRICS:\n• U-value: Heat transfer (lower = better insulation)\n• SHGC: Solar heat gain coefficient (0-1)\n\nTYPICAL REQUIREMENTS:\n• Zone 4-5: Single glazing acceptable with limits\n• Zone 6+: Double glazing often required\n\nGLAZING TYPES & U-VALUES:\n• Single clear: U=5.8, SHGC=0.86\n• Single low-e: U=3.6, SHGC=0.67\n• Double clear: U=2.8, SHGC=0.76\n• Double low-e: U=1.8, SHGC=0.56\n\nPRICING (per m²):\n• Single clear: $100-150/m²\n• Single low-e: $150-220/m²\n• Double glazed: $350-500/m²\n• Double low-e: $450-650/m²",
    keyRequirements: [
      "Glazing area limits depend on orientation",
      "North glazing best, west worst for cooling",
      "Low-e coating reduces heat transfer",
      "Consider shading devices for west/north"
    ]
  },
  {
    id: "J1.6",
    section: "Part J1.6",
    title: "Building Sealing",
    keywords: ["sealing", "air leakage", "draft", "airtight", "gaps"],
    description: "Building sealing and air leakage requirements",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/13-energy-efficiency/part-134-building-sealing",
    category: "Energy Efficiency",
    estimationNotes: "SEALING REQUIREMENTS:\n\nKEY AREAS TO SEAL:\n• Windows and doors (weatherstripping)\n• Wall/ceiling junctions\n• Exhaust fan penetrations\n• Pipe and cable penetrations\n• Skirting boards\n\nMATERIALS:\n• Door seals (per door): $30-60\n• Window weatherstrip: $5-15/m\n• Acoustic sealant: $15-25/tube\n• Foam gap filler: $8-15/can\n• Draft excluders: $15-40 each\n\nBLOWER DOOR TEST:\n• Recommended for 7+ star homes\n• Cost: $400-800 per test",
    keyRequirements: [
      "All exhaust fans must have dampers",
      "Weatherstrip external doors and windows",
      "Seal around penetrations",
      "Consider air barrier in wall system"
    ]
  },
  {
    id: "J3.2",
    section: "Part J3.2",
    title: "Star Rating Requirements",
    keywords: ["star", "star rating", "NatHERS", "energy rating", "6 star", "7 star"],
    description: "Energy star rating requirements for new dwellings",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/13-energy-efficiency/part-131-energy-efficiency",
    category: "Energy Efficiency",
    estimationNotes: "NatHERS STAR RATINGS:\n\nCURRENT REQUIREMENTS (NCC 2022+):\n• Minimum 7 stars (thermal performance)\n• Whole-of-home energy budget\n\nCOST IMPACT PER STAR:\n• 6→7 stars: +$5,000-15,000\n• 7→8 stars: +$10,000-25,000\n• 8→9 stars: +$20,000-40,000\n\nKEY STRATEGIES:\n• Orientation (north living areas)\n• Insulation above minimum\n• Quality glazing\n• Shading devices\n• Thermal mass\n\nNatHERS ASSESSMENT:\n• Cost: $300-600 per assessment\n• Required at DA or before construction",
    keyRequirements: [
      "7-star minimum for new builds (2022+)",
      "NatHERS assessment required",
      "Orientation affects rating significantly",
      "May need multiple assessments during design"
    ]
  },
  {
    id: "J5.2",
    section: "Part J5.2",
    title: "Hot Water Systems",
    keywords: ["hot water", "water heater", "solar", "heat pump"],
    description: "Energy efficiency for hot water systems",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/13-energy-efficiency/part-136-services",
    category: "Energy Efficiency",
    estimationNotes: "HOT WATER REQUIREMENTS:\n\nCOMPLIANT OPTIONS:\n• Solar hot water (gas boosted): Most efficient\n• Heat pump: Electric, high efficiency\n• Gas instantaneous: 5-star+ rating\n• Electric storage: Generally NOT compliant\n\nPRICING (supply + install):\n• Solar + gas boost: $4,000-7,000\n• Heat pump: $3,500-6,000\n• Gas instantaneous: $1,200-2,500\n• Electric (if allowed): $800-1,500\n\nREBATES (check current):\n• Heat pump: $400-1,000 federal/state\n• Solar HW: Varies by state\n\nSIZING:\n• 1-2 people: 160-200L\n• 3-4 people: 250-315L\n• 5+ people: 315-400L",
    keyRequirements: [
      "Electric storage generally not compliant",
      "Gas systems must be 5-star or higher",
      "Solar/heat pump preferred in most zones",
      "Check state rebates before specifying"
    ]
  },

  // PLUMBING CODE - SECTION A
  {
    id: "PCA1.3",
    section: "Plumbing Code Part A1.3",
    title: "Water Supply",
    keywords: ["water", "water supply", "plumbing", "pipe", "connection"],
    description: "Water supply system requirements",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-three/cold-water-services",
    category: "Plumbing",
    estimationNotes: "WATER SUPPLY PIPE SIZES:\n• Water main connection: 20-25mm\n• Internal mains: 20mm copper/Pex\n• Branches: 15mm typical\n• Toilet/basin: 15mm\n• Shower/bath: 15mm\n\nMATERIALS:\n• Copper Type B: $15-25/m (installed)\n• Pex-A pipe: $8-15/m (installed)\n• Brass fittings: $10-40 each\n\nFIXTURE ROUGH-IN:\n• Per fixture point: $250-450\n• Include stop valves at fixtures\n• Pressure limiting valve if >500kPa",
    keyRequirements: [
      "Mains pressure typically 200-500kPa",
      "Backflow prevention at main",
      "Hot water tempering valve (50°C max at fixtures)",
      "Licenced plumber required"
    ]
  },
  {
    id: "PCA2.2",
    section: "Plumbing Code Part A2.2",
    title: "Sanitary Drainage",
    keywords: ["drainage", "sewer", "sanitary", "waste", "drain"],
    description: "Sanitary drainage and sewerage requirements",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-three/sanitary-plumbing-drainage-systems",
    category: "Plumbing",
    estimationNotes: "DRAIN PIPE SIZES:\n• Toilet branch: 100mm\n• Floor waste: 50mm min (65mm preferred)\n• Basin: 40mm\n• Shower: 50mm\n• Main sewer: 100mm min\n\nGRADES (fall per metre):\n• 100mm pipe: 1:60 min (1.65%)\n• 65mm pipe: 1:40 min\n• 50mm pipe: 1:40 min\n\nPRICING:\n• 100mm PVC per metre (installed): $80-150\n• Sewer connection fee: $1,500-4,000\n• Inspection opening: $80-150 each\n• Junction: $30-60 each",
    keyRequirements: [
      "Inspection opening within 20m of sewer",
      "Vent pipe to atmosphere required",
      "All fixtures must be trapped",
      "Sewer diagram required for authority"
    ]
  },
  {
    id: "PCA3.1",
    section: "Plumbing Code Part A3.1",
    title: "Stormwater Drainage",
    keywords: ["stormwater", "storm", "drainage", "gutter", "downpipe", "rainwater"],
    description: "Stormwater drainage system requirements",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-three/stormwater-drainage-systems",
    category: "Plumbing",
    estimationNotes: "SIZING (based on catchment):\n\nDOWNPIPES:\n• 90mm round: 90m² roof area\n• 100mm square: 130m² roof area\n\nAG DRAINS:\n• 90mm slotted: Standard residential\n• 100mm slotted: Higher flow areas\n\nPRICING:\n• Quad gutter (installed): $40-60/m\n• Downpipe 90mm: $25-40/m\n• 90mm AG drain: $15-25/m\n• Stormwater pit: $200-400\n• Rainhead: $40-80 each\n• Connection to council: $500-2,000",
    keyRequirements: [
      "Cannot discharge to sewer",
      "Must connect to approved outlet",
      "Overflow provisions required",
      "Surcharge gully at low points"
    ]
  },
  {
    id: "PCB1.2",
    section: "Plumbing Code Part B1.2",
    title: "Greywater Systems",
    keywords: ["greywater", "grey water", "recycled", "reuse"],
    description: "Greywater treatment and reuse systems",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-three/non-drinking-water-services",
    category: "Plumbing",
    estimationNotes: "GREYWATER SOURCES:\n• Bathroom (sink, shower, bath)\n• Laundry\n• NOT kitchen or toilet\n\nUSE RESTRICTIONS:\n• Subsurface irrigation only (typical)\n• Not for drinking/cooking\n• Treatment required for surface irrigation\n\nSYSTEMS:\n• Diversion only: $500-1,500\n• Treatment system: $2,000-6,000\n• Council approval required\n\nBASRA REQUIREMENTS:\n• NSW: Mandatory for new homes\n• Other states: Check local requirements",
    keyRequirements: [
      "Purple pipes for greywater",
      "Signage required",
      "Council approval needed",
      "Separate from stormwater/sewer"
    ]
  },
  {
    id: "PCB2.3",
    section: "Plumbing Code Part B2.3",
    title: "Rainwater Tanks",
    keywords: ["rainwater", "water tank", "tank", "storage"],
    description: "Rainwater harvesting and storage requirements",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-three/non-drinking-water-services/rainwater-harvesting-and-use",
    category: "Plumbing",
    estimationNotes: "TANK REQUIREMENTS:\n\nSIZING (BASIX typical):\n• 2,000L minimum (NSW)\n• Connected to toilets/laundry typical\n\nCOMPONENTS:\n• Poly tank 2,000L: $400-700\n• Poly tank 5,000L: $800-1,500\n• Pump system: $400-800\n• First flush diverter: $80-150\n• Install (complete): $1,500-3,000\n\nCONNECTION OPTIONS:\n• Toilet only: Simplest\n• Toilet + laundry: Common\n• Whole house (with mains backup): Premium",
    keyRequirements: [
      "Backflow prevention to mains required",
      "Mosquito-proof strainer",
      "First flush device recommended",
      "Overflow to stormwater"
    ]
  },

  // ROOFING AND EXTERNAL
  {
    id: "B1.3-Roof",
    section: "Part B1.3",
    title: "Roof and Wall Cladding",
    keywords: ["roof", "roofing", "cladding", "tiles", "colorbond", "membrane"],
    description: "Requirements for roof and wall cladding systems",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/7-roof-and-wall-cladding/part-72-roof-cladding",
    category: "Structure",
    estimationNotes: "ROOFING OPTIONS:\n\nMETAL ROOFING (Colorbond):\n• Custom Orb: $25-40/m² (supply)\n• Kliplok: $35-50/m² (supply)\n• Install labour: $25-40/m²\n• Sarking: $4-8/m²\n\nTILES:\n• Concrete tiles: $15-25/m² (supply)\n• Terracotta: $35-60/m² (supply)\n• Install labour: $35-50/m²\n\nMINIMUM PITCH:\n• Metal: 5° (with clips) to 10° typical\n• Tiles: 20° minimum",
    keyRequirements: [
      "Minimum roof pitch varies by material",
      "Sarking mandatory in most climates",
      "Fix pattern per wind classification",
      "Flashings at all penetrations"
    ]
  },
  {
    id: "B1.5-Gutter",
    section: "Part B1.5",
    title: "Gutters and Downpipes",
    keywords: ["gutter", "downpipe", "downspout", "rainwater"],
    description: "Gutter and downpipe sizing and installation",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/7-roof-and-wall-cladding/part-74-gutters-and-downpipes",
    category: "Structure",
    estimationNotes: "GUTTER SIZING:\n• Quad 115mm: Standard residential\n• Half-round 150mm: Higher rainfall areas\n• Box gutter: Commercial/multi-storey\n\nDOWNPIPE COVERAGE:\n• 90mm round: 90m² roof area\n• 100mm square: 130m² roof area\n\nPRICING (supply + install):\n• Colorbond quad gutter: $40-60/m\n• Downpipe 90mm: $25-40/m\n• Rainhead: $40-80\n• Pop rivets, silicone, etc: Allow 15%",
    keyRequirements: [
      "Fall 1:500 minimum towards outlets",
      "Overflow provisions required",
      "Sumps at downpipes recommended",
      "Leaf guards in bushy areas"
    ]
  },

  // FRAMING SPECIFICS
  {
    id: "B1.2-Frame",
    section: "Part B1.2",
    title: "Wall and Floor Framing",
    keywords: ["framing", "frame", "stud", "joist", "bearer", "timber", "steel"],
    description: "Wall and floor framing requirements and loadings",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-two/h-class-1-and-10-buildings/part-h1-structure",
    category: "Structure",
    estimationNotes: "TIMBER FRAMING SIZES:\n\nWALL STUDS (typically 90×45 MGP10):\n• 450mm centres: Standard internal\n• 600mm centres: With bracing ply\n• Lintel over openings as per span tables\n\nFLOOR JOISTS (typically 190×45 MGP10):\n• 450mm centres: Most residential\n• Bearer spacing as per span tables\n\nSTEEL FRAMING:\n• 64mm C-section: Non-load bearing\n• 92mm C-section: Load bearing walls\n• Cost premium ~30-50% over timber\n\nPRICING (per m²):\n• Timber wall framing: $50-80/m²\n• Steel wall framing: $70-110/m²\n• Floor framing: $60-100/m²",
    keyRequirements: [
      "Stress grade (MGP10/12/15) per engineer",
      "Noggins at 1350mm max centres",
      "Double studs at openings",
      "Treated timber at wet areas/external"
    ]
  },
  {
    id: "B1.2-Bracing",
    section: "Part B1.2",
    title: "Wall Bracing",
    keywords: ["bracing", "racking", "lateral", "wind"],
    description: "Wall bracing for wind and racking resistance",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/volume-two/h-class-1-and-10-buildings/part-h1-structure",
    category: "Structure",
    estimationNotes: "BRACING REQUIREMENTS:\n\nWIND CLASSIFICATION ZONES:\n• N1-N2: Low wind (most suburban)\n• N3-N4: Medium wind\n• C1-C4: Cyclonic regions\n\nBRACING TYPES:\n• Structural ply 7mm: 4.0-6.0 kN/m\n• Metal strap bracing: 2.0-3.0 kN/m\n• Metal angle bracing: 3.5-5.0 kN/m\n• Plasterboard bracing: 0.45-0.75 kN/m\n\nPRICING:\n• Structural ply 7mm: $40-55/sheet\n• Metal strap brace: $15-25 each\n• Add 10-15% to frame cost for bracing",
    keyRequirements: [
      "Bracing schedule per wind classification",
      "Distributed around building perimeter",
      "Engineering for irregular shapes",
      "Tie-downs at bracing points"
    ]
  },

  // ELECTRICAL (Referenced)
  {
    id: "AS3000",
    section: "AS/NZS 3000:2018",
    title: "Electrical Wiring Rules",
    keywords: ["electrical", "wiring", "power", "switch", "switchboard", "RCD"],
    description: "Australian electrical installation standards",
    url: "https://www.standards.org.au/",
    category: "Electrical",
    estimationNotes: "ELECTRICAL ROUGH-IN:\n\nPER POINT PRICING:\n• Power point: $80-150\n• Light point: $80-120\n• Switch: $60-100\n• Data point: $100-180\n• TV point: $80-130\n\nSWITCHBOARD:\n• Basic 12-way: $600-1,200\n• 18-24 way: $1,000-1,800\n• Smart/home automation: +50-100%\n\nRCD REQUIREMENTS:\n• All circuits must have RCD protection\n• Max 3 circuits per 30mA RCD\n• Separate RCDs for smoke alarms",
    keyRequirements: [
      "Licensed electrician required",
      "RCD protection on all circuits",
      "Smoke alarms hardwired + interconnected",
      "Certificate of compliance required"
    ]
  },

  // TERMITE PROTECTION
  {
    id: "B1.3-Termite",
    section: "Part B1.3",
    title: "Termite Risk Management",
    keywords: ["termite", "white ant", "pest", "barrier", "treated timber"],
    description: "Protection against subterranean termite entry",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/3-site-preparation/part-35-termite-risk-management",
    category: "Structure",
    estimationNotes: "TERMITE MANAGEMENT OPTIONS:\n\nPHYSICAL BARRIERS:\n• Granite particle barrier: $25-40/LM\n• S/S mesh (Termi-Mesh): $30-50/LM\n• Plastic sheet systems: $15-25/m²\n\nCHEMICAL BARRIERS:\n• Under-slab treatment: $8-15/m²\n• Perimeter treatment: $20-35/LM\n• Reticulation system: +$800-1,500\n\nDURABILITY:\n• Chemical: 5-10 year warranty\n• Physical: 25+ years\n\nREQUIRED IN:\n• All of Australia except Tas & some Vic areas",
    keyRequirements: [
      "Check AS 3660.1 for requirements",
      "Certificate from installer required",
      "Maintain 75mm clearance to ground",
      "Inspection zone maintained"
    ]
  },

  // GENERAL CONSTRUCTION
  {
    id: "General",
    section: "General Construction",
    title: "Construction Standards",
    keywords: ["construction", "building", "standard", "workmanship"],
    description: "General construction and workmanship standards",
    url: "https://ncc.abcb.gov.au/",
    category: "General",
    estimationNotes: "KEY TOLERANCES:\n\n• Wall plumb: 10mm in 2400mm\n• Floor level: 10mm in 4m\n• Door/window plumb: 3mm\n• Joints in timber: 2mm gap max\n\nDOCUMENTATION REQUIRED:\n• Building permit/approval\n• Inspections at each stage\n• Final occupancy certificate\n\nTYPICAL INSPECTIONS:\n1. Footings (before pour)\n2. Slab (before pour)\n3. Frame\n4. Pre-lining (wet areas)\n5. Final",
    keyRequirements: [
      "All work to comply with NCC 2022/2025",
      "Licensed builders for work >$5K (varies by state)",
      "Home warranty insurance for work >$12K",
      "Inspections at critical stages"
    ]
  },

  // CONDENSATION
  {
    id: "F7.2",
    section: "Part F7.2",
    title: "Condensation Management",
    keywords: ["condensation", "moisture", "vapor", "vapour barrier", "sarking"],
    description: "Managing condensation in roof and wall spaces",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/10-health-and-amenity/part-106-condensation-management",
    category: "Health & Amenity",
    estimationNotes: "CONDENSATION CONTROL:\n\nVAPOUR BARRIERS:\n• Required in Climate Zones 6-8\n• Install on warm side of insulation\n• 0.2mm poly sheet: $1-2/m²\n• Reflective foil with vapour barrier: $4-8/m²\n\nVENTILATION:\n• Roof space: 1/150 of ceiling area\n• Sub-floor: 1/150 of floor area\n• Cross-flow ventilation required\n\nSARKING:\n• Breathable (not foil) in cold climates\n• Installed under roof cladding",
    keyRequirements: [
      "Vapour barrier on warm side in cold climates",
      "Use breathable sarking in Zone 6-8",
      "Ventilate roof and subfloor spaces",
      "Seal penetrations in vapour barrier"
    ]
  },

  // GLAZING SAFETY
  {
    id: "D2.20",
    section: "Part D2.20",
    title: "Glazing in Hazardous Locations",
    keywords: ["glass", "glazing", "safety glass", "laminated", "tempered"],
    description: "Safety glazing requirements near doors, baths, and low heights",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/8-glazing/part-82-glazing-construction",
    category: "Access & Egress",
    estimationNotes: "SAFETY GLASS REQUIRED:\n\nLOCATIONS:\n• Within 300mm of door edges\n• Glass doors (fully framed: toughened ok)\n• Below 500mm from floor\n• Within 2m of stairs/ramps\n• Bath/shower enclosures\n• Pool fencing\n\nSAFETY GLASS TYPES:\n• Grade A toughened: Most applications\n• Grade B laminated: Overhead, balustrades\n\nPRICING PREMIUM:\n• Safety glass: +$30-60/m² over standard\n• Laminated: +$50-100/m² over toughened",
    keyRequirements: [
      "Grade A for most hazardous locations",
      "Grade B for overhead/balustrades",
      "Permanent marking required on glass",
      "Manifestation on large glass panels"
    ]
  },

  // FALL PROTECTION
  {
    id: "D2.15",
    section: "Part D2.15",
    title: "Openings in Floors",
    keywords: ["opening", "hole", "floor opening", "protection"],
    description: "Protection of openings in floors and roofs",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-113-barriers-and-handrails",
    category: "Access & Egress",
    estimationNotes: "FLOOR OPENING PROTECTION:\n\nREQUIREMENTS:\n• Any opening >125mm requires protection\n• Barrier OR covers with load rating\n\nLIFT/STAIR VOIDS:\n• Barrier height 1000mm (>4m fall)\n• 125mm sphere test\n\nACCESS HATCHES:\n• Minimum cover load: 1.5kN point load\n• Locked if in trafficable area\n\nROOF ACCESS:\n• Fall protection >2m drop\n• Anchor points for maintenance",
    keyRequirements: [
      "All openings >125mm protected",
      "Barrier height per drop height",
      "Covers must be loadbearing",
      "Consider construction-phase safety"
    ]
  },

  // EXTERNAL WALLS
  {
    id: "B2.4",
    section: "Part B2.4",
    title: "External Walls",
    keywords: ["external wall", "cladding", "weatherproofing", "render"],
    description: "External wall construction and weather resistance",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/7-roof-and-wall-cladding/part-73-wall-cladding",
    category: "Structure",
    estimationNotes: "CLADDING OPTIONS:\n\nBRICK VENEER:\n• Clay brick: $80-150/m² (laid)\n• Concrete brick: $60-100/m² (laid)\n• Wall ties: $0.50-1 each\n\nFIBRE CEMENT:\n• Weatherboard: $60-100/m² (supply + fix)\n• Sheet (Scyon): $50-80/m²\n\nTIMBER:\n• Hardwood weatherboard: $80-150/m²\n• Treated pine: $50-80/m²\n\nMETAL:\n• Colorbond panels: $40-70/m²\n• Steel sheet cladding: $50-90/m²\n\nRENDER:\n• Acrylic on foam: $80-130/m²\n• Cement render: $60-100/m²",
    keyRequirements: [
      "Sarking/wrap mandatory under cladding",
      "Weep holes in brick veneer",
      "Flashings at all openings",
      "50mm cavity behind brick veneer"
    ]
  },

  // SITE PREPARATION
  {
    id: "B1.1",
    section: "Part B1.1",
    title: "Site Preparation",
    keywords: ["site", "excavation", "fill", "compaction", "earthworks"],
    description: "Site preparation and earthworks requirements",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/3-site-preparation/part-31-excavation-and-filling",
    category: "Structure",
    estimationNotes: "SITE WORKS:\n\nEXCAVATION:\n• Topsoil strip: $8-15/m³\n• Bulk excavation: $20-40/m³\n• Rock excavation: $80-200/m³\n\nFILL:\n• Select fill (compacted): $40-70/m³\n• Road base: $50-80/m³\n• Sand: $50-80/m³\n\nCOMPACTION:\n• 95% standard compaction required\n• Testing: $300-500 per test\n\nSITE COSTS:\n• Site establishment: $2,000-5,000\n• Temporary fencing: $30-50/LM\n• Site toilet: $150-250/week",
    keyRequirements: [
      "Geotechnical report for fill sites",
      "Controlled fill in layers (150-200mm)",
      "Compaction testing required",
      "Retaining where fill >1m"
    ]
  },

  // RETAINING WALLS
  {
    id: "B1.2-Retain",
    section: "Part B1.2",
    title: "Retaining Walls",
    keywords: ["retaining wall", "retaining", "earth", "retention"],
    description: "Structural requirements for retaining walls",
    url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/3-site-preparation/part-32-retaining-structures",
    category: "Structure",
    estimationNotes: "RETAINING WALLS:\n\nTYPES & PRICING (per m² face):\n• Timber sleepers (≤600mm): $150-250/m²\n• Concrete sleepers (≤1m): $200-350/m²\n• Besser block (≤1m): $250-400/m²\n• Concrete (engineered): $400-700/m²\n• Crib wall: $300-500/m²\n\nENGINEERING REQUIRED:\n• Generally >600mm retained height\n• Always if surcharge loads\n• Near boundaries or buildings\n\nDRAINAGE:\n• AG drain behind wall essential\n• Drainage cell mat: $20-30/m²\n• Weep holes at 1.5m centres",
    keyRequirements: [
      "Engineering for walls >600mm",
      "Drainage behind all retaining walls",
      "Consider surcharge from driveways/buildings",
      "Boundary setbacks may apply"
    ]
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
