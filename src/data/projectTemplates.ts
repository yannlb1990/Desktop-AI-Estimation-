// Smart Project Templates System
// Pre-built scopes for common Australian construction job types

export interface TemplateLineItem {
  id: string;
  trade: string;
  sow: string;
  description: string;
  unit: 'lm' | 'm²' | 'm³' | 'ea' | 'hr' | 'day' | 'allow';
  defaultQty: number;
  estimatedRate: number;
  category: string;
  nccCodes?: string[];
  isRequired?: boolean;
  notes?: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'residential' | 'commercial' | 'renovation' | 'extension' | 'new-build';
  subCategory: string;
  icon: string;
  typicalDuration: string;
  typicalBudgetRange: { min: number; max: number };
  lineItems: TemplateLineItem[];
  commonVariations: string[];
  nccRequirements: string[];
  tags: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // ============================================
  // BATHROOM RENOVATIONS
  // ============================================
  {
    id: 'bathroom-full-reno',
    name: 'Full Bathroom Renovation',
    description: 'Complete bathroom strip-out and rebuild including waterproofing, tiling, fixtures, and fittings',
    category: 'renovation',
    subCategory: 'Bathroom',
    icon: 'Bath',
    typicalDuration: '2-3 weeks',
    typicalBudgetRange: { min: 15000, max: 35000 },
    commonVariations: [
      'Premium fixtures upgrade',
      'Heated towel rail addition',
      'Underfloor heating',
      'Custom vanity',
      'Frameless shower screen'
    ],
    nccRequirements: ['F1.7', 'F1.9', 'B1.4', 'F2.5'],
    tags: ['bathroom', 'wet area', 'waterproofing', 'tiling'],
    lineItems: [
      // Demolition
      {
        id: 'bath-demo-1',
        trade: 'Demolition',
        sow: 'Strip Out Existing Bathroom',
        description: 'Remove all existing fixtures, tiles, waterproofing membrane, and prepare for new works',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 1500,
        category: 'Demolition',
        isRequired: true
      },
      {
        id: 'bath-demo-2',
        trade: 'Demolition',
        sow: 'Waste Removal',
        description: 'Skip bin and disposal of demolition waste',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 450,
        category: 'Demolition',
        isRequired: true
      },
      // Plumbing
      {
        id: 'bath-plumb-1',
        trade: 'Plumber',
        sow: 'Plumbing Rough-In',
        description: 'Relocate/install new waste, water supply, and drainage as required',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 2200,
        category: 'First Fix',
        nccCodes: ['B1.4'],
        isRequired: true
      },
      {
        id: 'bath-plumb-2',
        trade: 'Plumber',
        sow: 'Plumbing Fit-Off',
        description: 'Connect all fixtures including toilet, basin, shower, tapware',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 1800,
        category: 'Fit Out',
        isRequired: true
      },
      // Waterproofing
      {
        id: 'bath-wp-1',
        trade: 'Waterproofer',
        sow: 'Waterproofing Membrane',
        description: 'Apply waterproofing membrane to shower, floor and wet areas per AS3740',
        unit: 'm²',
        defaultQty: 12,
        estimatedRate: 85,
        category: 'Wet Areas',
        nccCodes: ['F1.7'],
        isRequired: true,
        notes: 'Must be applied by licensed waterproofer with certificate'
      },
      {
        id: 'bath-wp-2',
        trade: 'Waterproofer',
        sow: 'Waterproofing Certificate',
        description: 'Provide waterproofing compliance certificate',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 150,
        category: 'Wet Areas',
        nccCodes: ['F1.7'],
        isRequired: true
      },
      // Electrical
      {
        id: 'bath-elec-1',
        trade: 'Electrician',
        sow: 'Electrical Rough-In',
        description: 'Install new circuits, switch points, and GPO locations',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 850,
        category: 'First Fix',
        isRequired: true
      },
      {
        id: 'bath-elec-2',
        trade: 'Electrician',
        sow: 'Exhaust Fan Supply & Install',
        description: 'Supply and install exhaust fan with timer/humidity sensor',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 380,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'bath-elec-3',
        trade: 'Electrician',
        sow: 'LED Downlights',
        description: 'Supply and install IP44 rated LED downlights',
        unit: 'ea',
        defaultQty: 4,
        estimatedRate: 95,
        category: 'Fit Out'
      },
      {
        id: 'bath-elec-4',
        trade: 'Electrician',
        sow: 'Electrical Fit-Off',
        description: 'Install switches, GPOs, and final connections',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 450,
        category: 'Fit Out',
        isRequired: true
      },
      // Tiling
      {
        id: 'bath-tile-1',
        trade: 'Tiler',
        sow: 'Floor Tiling',
        description: 'Supply and install floor tiles including adhesive, grout, and waterproof sealer',
        unit: 'm²',
        defaultQty: 6,
        estimatedRate: 145,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'bath-tile-2',
        trade: 'Tiler',
        sow: 'Wall Tiling',
        description: 'Supply and install wall tiles to shower and feature walls',
        unit: 'm²',
        defaultQty: 18,
        estimatedRate: 135,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'bath-tile-3',
        trade: 'Tiler',
        sow: 'Tile Niche',
        description: 'Form and tile recessed shower niche',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 280,
        category: 'Fit Out'
      },
      // Fixtures
      {
        id: 'bath-fix-1',
        trade: 'Supplier',
        sow: 'Toilet Suite',
        description: 'Supply toilet suite - wall hung or back to wall',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 650,
        category: 'Materials'
      },
      {
        id: 'bath-fix-2',
        trade: 'Supplier',
        sow: 'Vanity Unit',
        description: 'Supply vanity with basin and tapware',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 1200,
        category: 'Materials'
      },
      {
        id: 'bath-fix-3',
        trade: 'Supplier',
        sow: 'Shower Screen',
        description: 'Supply and install frameless/semi-frameless shower screen',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 1100,
        category: 'Materials'
      },
      {
        id: 'bath-fix-4',
        trade: 'Supplier',
        sow: 'Shower Mixer & Rail',
        description: 'Supply shower mixer, rail, and hand shower',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 450,
        category: 'Materials'
      },
      {
        id: 'bath-fix-5',
        trade: 'Supplier',
        sow: 'Mirror Cabinet',
        description: 'Supply shaving cabinet/mirror',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 380,
        category: 'Materials'
      },
      {
        id: 'bath-fix-6',
        trade: 'Supplier',
        sow: 'Accessories',
        description: 'Towel rail, toilet roll holder, robe hooks',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 250,
        category: 'Materials'
      },
      // Finishing
      {
        id: 'bath-finish-1',
        trade: 'Painter',
        sow: 'Painting',
        description: 'Prepare and paint ceiling and non-tiled walls',
        unit: 'm²',
        defaultQty: 8,
        estimatedRate: 35,
        category: 'Fit Out'
      },
      {
        id: 'bath-finish-2',
        trade: 'Carpenter',
        sow: 'Door & Architraves',
        description: 'Supply and install new door, frame, and architraves if required',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 650,
        category: 'Fit Out'
      }
    ]
  },

  // ============================================
  // KITCHEN RENOVATIONS
  // ============================================
  {
    id: 'kitchen-full-reno',
    name: 'Full Kitchen Renovation',
    description: 'Complete kitchen strip-out and rebuild including cabinetry, benchtops, appliances, and finishes',
    category: 'renovation',
    subCategory: 'Kitchen',
    icon: 'ChefHat',
    typicalDuration: '3-4 weeks',
    typicalBudgetRange: { min: 25000, max: 60000 },
    commonVariations: [
      'Stone benchtop upgrade',
      'Butler\'s pantry',
      'Island bench addition',
      'Premium appliance package',
      'Custom joinery'
    ],
    nccRequirements: ['F2.5', 'E2.2', 'G6.1'],
    tags: ['kitchen', 'cabinetry', 'benchtops', 'appliances'],
    lineItems: [
      // Demolition
      {
        id: 'kit-demo-1',
        trade: 'Demolition',
        sow: 'Strip Out Existing Kitchen',
        description: 'Remove all existing cabinetry, appliances, benchtops, splashback',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 1800,
        category: 'Demolition',
        isRequired: true
      },
      {
        id: 'kit-demo-2',
        trade: 'Demolition',
        sow: 'Waste Removal',
        description: 'Skip bin and disposal of demolition waste',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 550,
        category: 'Demolition',
        isRequired: true
      },
      // Plumbing
      {
        id: 'kit-plumb-1',
        trade: 'Plumber',
        sow: 'Plumbing Rough-In',
        description: 'Relocate/install water supply and waste for sink, dishwasher',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 1200,
        category: 'First Fix',
        isRequired: true
      },
      {
        id: 'kit-plumb-2',
        trade: 'Plumber',
        sow: 'Gas Connection',
        description: 'Connect gas cooktop (if applicable)',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 350,
        category: 'First Fix'
      },
      {
        id: 'kit-plumb-3',
        trade: 'Plumber',
        sow: 'Plumbing Fit-Off',
        description: 'Connect sink, tapware, and dishwasher',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 650,
        category: 'Fit Out',
        isRequired: true
      },
      // Electrical
      {
        id: 'kit-elec-1',
        trade: 'Electrician',
        sow: 'Electrical Rough-In',
        description: 'New circuits for oven, cooktop, rangehood, GPOs',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 1400,
        category: 'First Fix',
        isRequired: true
      },
      {
        id: 'kit-elec-2',
        trade: 'Electrician',
        sow: 'LED Downlights',
        description: 'Supply and install LED downlights',
        unit: 'ea',
        defaultQty: 6,
        estimatedRate: 85,
        category: 'Fit Out'
      },
      {
        id: 'kit-elec-3',
        trade: 'Electrician',
        sow: 'Under Cabinet Lighting',
        description: 'Supply and install LED strip under overhead cabinets',
        unit: 'lm',
        defaultQty: 4,
        estimatedRate: 95,
        category: 'Fit Out'
      },
      {
        id: 'kit-elec-4',
        trade: 'Electrician',
        sow: 'Electrical Fit-Off',
        description: 'Install switches, GPOs, connect appliances',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 850,
        category: 'Fit Out',
        isRequired: true
      },
      // Cabinetry
      {
        id: 'kit-cab-1',
        trade: 'Cabinet Maker',
        sow: 'Base Cabinets',
        description: 'Supply and install base cabinets with soft-close drawers/doors',
        unit: 'lm',
        defaultQty: 5,
        estimatedRate: 850,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'kit-cab-2',
        trade: 'Cabinet Maker',
        sow: 'Overhead Cabinets',
        description: 'Supply and install overhead cabinets with soft-close doors',
        unit: 'lm',
        defaultQty: 4,
        estimatedRate: 650,
        category: 'Fit Out'
      },
      {
        id: 'kit-cab-3',
        trade: 'Cabinet Maker',
        sow: 'Pantry Cabinet',
        description: 'Supply and install tall pantry with internal fittings',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 1800,
        category: 'Fit Out'
      },
      // Benchtops
      {
        id: 'kit-bench-1',
        trade: 'Stone Mason',
        sow: 'Stone Benchtop',
        description: 'Supply and install 20mm engineered stone benchtop with undermount sink cutout',
        unit: 'm²',
        defaultQty: 4,
        estimatedRate: 650,
        category: 'Fit Out',
        isRequired: true
      },
      // Splashback
      {
        id: 'kit-splash-1',
        trade: 'Tiler',
        sow: 'Tiled Splashback',
        description: 'Supply and install subway/feature tile splashback',
        unit: 'm²',
        defaultQty: 3,
        estimatedRate: 165,
        category: 'Fit Out'
      },
      // Appliances
      {
        id: 'kit-app-1',
        trade: 'Supplier',
        sow: 'Oven',
        description: 'Supply 600mm electric wall oven',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 1200,
        category: 'Materials'
      },
      {
        id: 'kit-app-2',
        trade: 'Supplier',
        sow: 'Cooktop',
        description: 'Supply 600mm gas/induction cooktop',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 900,
        category: 'Materials'
      },
      {
        id: 'kit-app-3',
        trade: 'Supplier',
        sow: 'Rangehood',
        description: 'Supply 600mm rangehood',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 650,
        category: 'Materials'
      },
      {
        id: 'kit-app-4',
        trade: 'Supplier',
        sow: 'Dishwasher',
        description: 'Supply integrated dishwasher',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 950,
        category: 'Materials'
      },
      {
        id: 'kit-app-5',
        trade: 'Supplier',
        sow: 'Sink & Tapware',
        description: 'Supply undermount sink and mixer tap',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 650,
        category: 'Materials'
      },
      // Finishing
      {
        id: 'kit-finish-1',
        trade: 'Painter',
        sow: 'Painting',
        description: 'Prepare and paint walls and ceiling',
        unit: 'm²',
        defaultQty: 35,
        estimatedRate: 28,
        category: 'Fit Out'
      },
      {
        id: 'kit-finish-2',
        trade: 'Flooring',
        sow: 'Floor Covering',
        description: 'Supply and install new flooring (tiles/vinyl/timber)',
        unit: 'm²',
        defaultQty: 15,
        estimatedRate: 120,
        category: 'Fit Out'
      }
    ]
  },

  // ============================================
  // GRANNY FLAT / SECONDARY DWELLING
  // ============================================
  {
    id: 'granny-flat-60m2',
    name: 'Granny Flat 60m²',
    description: 'Complete 60m² secondary dwelling including 1 bedroom, bathroom, kitchen, and living area',
    category: 'new-build',
    subCategory: 'Secondary Dwelling',
    icon: 'Home',
    typicalDuration: '10-14 weeks',
    typicalBudgetRange: { min: 120000, max: 180000 },
    commonVariations: [
      'Additional bedroom',
      'Larger kitchen',
      'Covered outdoor area',
      'Solar panels',
      'Split system A/C'
    ],
    nccRequirements: ['B1.2', 'B1.4', 'F1.7', 'F2.5', 'H6.2', 'J1.1'],
    tags: ['granny flat', 'secondary dwelling', 'new build', 'residential'],
    lineItems: [
      // Site Works
      {
        id: 'gf-site-1',
        trade: 'Site Works',
        sow: 'Site Preparation',
        description: 'Clear site, set out, and prepare for construction',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 3500,
        category: 'Site Works',
        isRequired: true
      },
      {
        id: 'gf-site-2',
        trade: 'Site Works',
        sow: 'Temporary Fencing',
        description: 'Install temporary fencing and site signage',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 850,
        category: 'Site Works',
        isRequired: true
      },
      // Concrete
      {
        id: 'gf-conc-1',
        trade: 'Concreter',
        sow: 'Slab on Ground',
        description: 'Supply and pour 100mm reinforced concrete slab with edge beams',
        unit: 'm²',
        defaultQty: 60,
        estimatedRate: 145,
        category: 'Structure',
        nccCodes: ['B1.2'],
        isRequired: true
      },
      // Framing
      {
        id: 'gf-frame-1',
        trade: 'Carpenter',
        sow: 'Wall Framing',
        description: 'Supply and erect timber wall frames including bracing',
        unit: 'm²',
        defaultQty: 60,
        estimatedRate: 85,
        category: 'Framing',
        nccCodes: ['B1.4'],
        isRequired: true
      },
      {
        id: 'gf-frame-2',
        trade: 'Carpenter',
        sow: 'Roof Framing',
        description: 'Supply and erect roof trusses/rafters',
        unit: 'm²',
        defaultQty: 65,
        estimatedRate: 75,
        category: 'Framing',
        nccCodes: ['B1.4'],
        isRequired: true
      },
      {
        id: 'gf-frame-3',
        trade: 'Carpenter',
        sow: 'Fascia & Gutters',
        description: 'Supply and install fascia, gutters, and downpipes',
        unit: 'lm',
        defaultQty: 35,
        estimatedRate: 65,
        category: 'External',
        isRequired: true
      },
      // Roofing
      {
        id: 'gf-roof-1',
        trade: 'Roofer',
        sow: 'Roof Sheeting',
        description: 'Supply and install Colorbond roof sheeting with sarking',
        unit: 'm²',
        defaultQty: 70,
        estimatedRate: 85,
        category: 'External',
        isRequired: true
      },
      // External Cladding
      {
        id: 'gf-clad-1',
        trade: 'Carpenter',
        sow: 'External Cladding',
        description: 'Supply and install weatherboard/fibre cement cladding',
        unit: 'm²',
        defaultQty: 85,
        estimatedRate: 110,
        category: 'External',
        isRequired: true
      },
      // Windows & Doors
      {
        id: 'gf-win-1',
        trade: 'Glazier',
        sow: 'Windows',
        description: 'Supply and install aluminium windows with flyscreens',
        unit: 'ea',
        defaultQty: 6,
        estimatedRate: 650,
        category: 'External',
        nccCodes: ['J1.1'],
        isRequired: true
      },
      {
        id: 'gf-door-1',
        trade: 'Carpenter',
        sow: 'Entry Door',
        description: 'Supply and install entry door with hardware',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 1200,
        category: 'External',
        isRequired: true
      },
      {
        id: 'gf-door-2',
        trade: 'Glazier',
        sow: 'Sliding Door',
        description: 'Supply and install sliding door to outdoor area',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 1800,
        category: 'External'
      },
      // Insulation
      {
        id: 'gf-ins-1',
        trade: 'Insulation',
        sow: 'Wall Insulation',
        description: 'Supply and install R2.5 wall batts',
        unit: 'm²',
        defaultQty: 85,
        estimatedRate: 18,
        category: 'First Fix',
        nccCodes: ['H6.2'],
        isRequired: true
      },
      {
        id: 'gf-ins-2',
        trade: 'Insulation',
        sow: 'Ceiling Insulation',
        description: 'Supply and install R4.0 ceiling batts',
        unit: 'm²',
        defaultQty: 60,
        estimatedRate: 22,
        category: 'First Fix',
        nccCodes: ['H6.2'],
        isRequired: true
      },
      // Plumbing
      {
        id: 'gf-plumb-1',
        trade: 'Plumber',
        sow: 'Plumbing Rough-In',
        description: 'Install all water supply, waste, and drainage',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 8500,
        category: 'First Fix',
        isRequired: true
      },
      {
        id: 'gf-plumb-2',
        trade: 'Plumber',
        sow: 'Hot Water System',
        description: 'Supply and install electric/gas hot water system',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 1800,
        category: 'First Fix',
        isRequired: true
      },
      {
        id: 'gf-plumb-3',
        trade: 'Plumber',
        sow: 'Plumbing Fit-Off',
        description: 'Connect all fixtures and fittings',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 3200,
        category: 'Fit Out',
        isRequired: true
      },
      // Electrical
      {
        id: 'gf-elec-1',
        trade: 'Electrician',
        sow: 'Electrical Rough-In',
        description: 'Install all wiring, switchboard, safety switches',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 6500,
        category: 'First Fix',
        isRequired: true
      },
      {
        id: 'gf-elec-2',
        trade: 'Electrician',
        sow: 'Electrical Fit-Off',
        description: 'Install all GPOs, switches, lights, smoke detectors',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 3500,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'gf-elec-3',
        trade: 'Electrician',
        sow: 'Split System A/C',
        description: 'Supply and install 5kW split system air conditioner',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 2200,
        category: 'Fit Out'
      },
      // Linings
      {
        id: 'gf-line-1',
        trade: 'Plasterer',
        sow: 'Plasterboard Linings',
        description: 'Supply and install 10mm plasterboard to walls and ceilings',
        unit: 'm²',
        defaultQty: 180,
        estimatedRate: 38,
        category: 'First Fix',
        isRequired: true
      },
      {
        id: 'gf-line-2',
        trade: 'Plasterer',
        sow: 'Cornice',
        description: 'Supply and install 55mm cove cornice',
        unit: 'lm',
        defaultQty: 75,
        estimatedRate: 18,
        category: 'First Fix'
      },
      // Waterproofing
      {
        id: 'gf-wp-1',
        trade: 'Waterproofer',
        sow: 'Bathroom Waterproofing',
        description: 'Apply waterproofing membrane to bathroom per AS3740',
        unit: 'm²',
        defaultQty: 8,
        estimatedRate: 85,
        category: 'Wet Areas',
        nccCodes: ['F1.7'],
        isRequired: true
      },
      // Kitchen
      {
        id: 'gf-kit-1',
        trade: 'Cabinet Maker',
        sow: 'Kitchen Cabinetry',
        description: 'Supply and install compact kitchen with base, overhead, and pantry',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 8500,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'gf-kit-2',
        trade: 'Stone Mason',
        sow: 'Kitchen Benchtop',
        description: 'Supply and install laminate/stone benchtop',
        unit: 'lm',
        defaultQty: 3,
        estimatedRate: 450,
        category: 'Fit Out',
        isRequired: true
      },
      // Bathroom Fixtures
      {
        id: 'gf-bath-1',
        trade: 'Tiler',
        sow: 'Bathroom Tiling',
        description: 'Supply and install floor and wall tiles to bathroom',
        unit: 'm²',
        defaultQty: 20,
        estimatedRate: 135,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'gf-bath-2',
        trade: 'Supplier',
        sow: 'Bathroom Fixtures',
        description: 'Supply toilet, vanity, shower screen, tapware, accessories',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 3500,
        category: 'Materials',
        isRequired: true
      },
      // Internal Doors
      {
        id: 'gf-idoor-1',
        trade: 'Carpenter',
        sow: 'Internal Doors',
        description: 'Supply and hang internal doors with hardware',
        unit: 'ea',
        defaultQty: 4,
        estimatedRate: 380,
        category: 'Fit Out',
        isRequired: true
      },
      // Flooring
      {
        id: 'gf-floor-1',
        trade: 'Flooring',
        sow: 'Floor Covering',
        description: 'Supply and install vinyl plank/hybrid flooring',
        unit: 'm²',
        defaultQty: 52,
        estimatedRate: 85,
        category: 'Fit Out',
        isRequired: true
      },
      // Painting
      {
        id: 'gf-paint-1',
        trade: 'Painter',
        sow: 'Internal Painting',
        description: 'Prepare and paint all internal walls and ceilings',
        unit: 'm²',
        defaultQty: 180,
        estimatedRate: 25,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'gf-paint-2',
        trade: 'Painter',
        sow: 'External Painting',
        description: 'Paint external cladding, fascia, and trims',
        unit: 'm²',
        defaultQty: 95,
        estimatedRate: 32,
        category: 'External',
        isRequired: true
      },
      // External Works
      {
        id: 'gf-ext-1',
        trade: 'Concreter',
        sow: 'Paths & Paving',
        description: 'Concrete paths and outdoor area',
        unit: 'm²',
        defaultQty: 15,
        estimatedRate: 95,
        category: 'External'
      },
      // Appliances
      {
        id: 'gf-app-1',
        trade: 'Supplier',
        sow: 'Kitchen Appliances',
        description: 'Supply oven, cooktop, rangehood',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 2200,
        category: 'Materials',
        isRequired: true
      }
    ]
  },

  // ============================================
  // DECK / OUTDOOR AREA
  // ============================================
  {
    id: 'timber-deck-30m2',
    name: 'Timber Deck 30m²',
    description: 'Elevated timber deck with stairs and balustrade',
    category: 'extension',
    subCategory: 'Outdoor',
    icon: 'Trees',
    typicalDuration: '1-2 weeks',
    typicalBudgetRange: { min: 12000, max: 25000 },
    commonVariations: [
      'Composite decking upgrade',
      'Built-in seating',
      'Pergola addition',
      'LED lighting',
      'Privacy screens'
    ],
    nccRequirements: ['B1.4', 'D2.16', 'D2.17'],
    tags: ['deck', 'outdoor', 'timber', 'balustrade'],
    lineItems: [
      {
        id: 'deck-frame-1',
        trade: 'Carpenter',
        sow: 'Subframe Construction',
        description: 'Supply and install treated pine bearers and joists',
        unit: 'm²',
        defaultQty: 30,
        estimatedRate: 145,
        category: 'Structure',
        nccCodes: ['B1.4'],
        isRequired: true
      },
      {
        id: 'deck-deck-1',
        trade: 'Carpenter',
        sow: 'Decking Boards',
        description: 'Supply and install 90x19 hardwood/treated pine decking',
        unit: 'm²',
        defaultQty: 30,
        estimatedRate: 120,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'deck-stair-1',
        trade: 'Carpenter',
        sow: 'Deck Stairs',
        description: 'Construct timber stairs with stringers and treads',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 1200,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'deck-bal-1',
        trade: 'Carpenter',
        sow: 'Balustrade',
        description: 'Supply and install timber/wire balustrade to code',
        unit: 'lm',
        defaultQty: 12,
        estimatedRate: 280,
        category: 'Fit Out',
        nccCodes: ['D2.16'],
        isRequired: true,
        notes: 'Required where deck height exceeds 1m'
      },
      {
        id: 'deck-foot-1',
        trade: 'Concreter',
        sow: 'Footings',
        description: 'Excavate and pour concrete pier footings',
        unit: 'ea',
        defaultQty: 9,
        estimatedRate: 185,
        category: 'Structure',
        isRequired: true
      },
      {
        id: 'deck-finish-1',
        trade: 'Painter',
        sow: 'Deck Oil/Stain',
        description: 'Apply two coats of decking oil or stain',
        unit: 'm²',
        defaultQty: 35,
        estimatedRate: 28,
        category: 'Fit Out'
      }
    ]
  },

  // ============================================
  // ELECTRICAL UPGRADE
  // ============================================
  {
    id: 'switchboard-upgrade',
    name: 'Switchboard Upgrade',
    description: 'Replace old fuse box with modern RCD-protected switchboard',
    category: 'renovation',
    subCategory: 'Electrical',
    icon: 'Zap',
    typicalDuration: '1 day',
    typicalBudgetRange: { min: 1500, max: 3500 },
    commonVariations: [
      'Additional circuits',
      'Surge protection',
      'Smart home ready',
      'EV charger circuit',
      '3-phase upgrade'
    ],
    nccRequirements: ['G6.1', 'G6.2'],
    tags: ['electrical', 'switchboard', 'safety', 'upgrade'],
    lineItems: [
      {
        id: 'sb-supply-1',
        trade: 'Electrician',
        sow: 'Switchboard Supply',
        description: 'Supply new switchboard enclosure with DIN rail',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 350,
        category: 'Materials',
        isRequired: true
      },
      {
        id: 'sb-main-1',
        trade: 'Electrician',
        sow: 'Main Switch',
        description: 'Supply and install 63A main switch',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 120,
        category: 'Materials',
        isRequired: true
      },
      {
        id: 'sb-rcd-1',
        trade: 'Electrician',
        sow: 'RCD Safety Switches',
        description: 'Supply and install RCD safety switches',
        unit: 'ea',
        defaultQty: 2,
        estimatedRate: 180,
        category: 'Materials',
        nccCodes: ['G6.2'],
        isRequired: true
      },
      {
        id: 'sb-mcb-1',
        trade: 'Electrician',
        sow: 'Circuit Breakers',
        description: 'Supply and install MCBs for all circuits',
        unit: 'ea',
        defaultQty: 12,
        estimatedRate: 35,
        category: 'Materials',
        isRequired: true
      },
      {
        id: 'sb-labour-1',
        trade: 'Electrician',
        sow: 'Installation Labour',
        description: 'Disconnect, remove old board, install and test new switchboard',
        unit: 'hr',
        defaultQty: 6,
        estimatedRate: 95,
        category: 'Labour',
        isRequired: true
      },
      {
        id: 'sb-cert-1',
        trade: 'Electrician',
        sow: 'Compliance Certificate',
        description: 'Issue electrical compliance certificate',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 150,
        category: 'Admin',
        isRequired: true
      }
    ]
  },

  // ============================================
  // LAUNDRY RENOVATION
  // ============================================
  {
    id: 'laundry-reno',
    name: 'Laundry Renovation',
    description: 'Complete laundry renovation including cabinetry, trough, and tiling',
    category: 'renovation',
    subCategory: 'Laundry',
    icon: 'Shirt',
    typicalDuration: '1-2 weeks',
    typicalBudgetRange: { min: 8000, max: 18000 },
    commonVariations: [
      'Custom cabinetry',
      'Stone benchtop',
      'Additional storage',
      'Drying cabinet',
      'Floor to ceiling tiles'
    ],
    nccRequirements: ['F1.7', 'F2.5'],
    tags: ['laundry', 'wet area', 'cabinetry'],
    lineItems: [
      {
        id: 'laun-demo-1',
        trade: 'Demolition',
        sow: 'Strip Out',
        description: 'Remove existing fixtures, trough, and floor covering',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 650,
        category: 'Demolition',
        isRequired: true
      },
      {
        id: 'laun-plumb-1',
        trade: 'Plumber',
        sow: 'Plumbing Works',
        description: 'Relocate/install taps, waste, and machine connections',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 1200,
        category: 'First Fix',
        isRequired: true
      },
      {
        id: 'laun-wp-1',
        trade: 'Waterproofer',
        sow: 'Waterproofing',
        description: 'Waterproof floor and splashback areas',
        unit: 'm²',
        defaultQty: 6,
        estimatedRate: 75,
        category: 'Wet Areas',
        nccCodes: ['F1.7'],
        isRequired: true
      },
      {
        id: 'laun-tile-1',
        trade: 'Tiler',
        sow: 'Floor Tiling',
        description: 'Supply and install floor tiles',
        unit: 'm²',
        defaultQty: 5,
        estimatedRate: 135,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'laun-tile-2',
        trade: 'Tiler',
        sow: 'Wall Tiling',
        description: 'Supply and install splashback tiles',
        unit: 'm²',
        defaultQty: 4,
        estimatedRate: 125,
        category: 'Fit Out'
      },
      {
        id: 'laun-cab-1',
        trade: 'Cabinet Maker',
        sow: 'Laundry Cabinetry',
        description: 'Supply and install base and overhead cabinets with benchtop',
        unit: 'lm',
        defaultQty: 3,
        estimatedRate: 750,
        category: 'Fit Out',
        isRequired: true
      },
      {
        id: 'laun-trough-1',
        trade: 'Supplier',
        sow: 'Laundry Trough',
        description: 'Supply stainless steel/acrylic trough with tapware',
        unit: 'ea',
        defaultQty: 1,
        estimatedRate: 450,
        category: 'Materials',
        isRequired: true
      },
      {
        id: 'laun-elec-1',
        trade: 'Electrician',
        sow: 'Electrical Works',
        description: 'Relocate GPOs, add lighting',
        unit: 'allow',
        defaultQty: 1,
        estimatedRate: 450,
        category: 'First Fix'
      },
      {
        id: 'laun-paint-1',
        trade: 'Painter',
        sow: 'Painting',
        description: 'Paint walls and ceiling',
        unit: 'm²',
        defaultQty: 15,
        estimatedRate: 28,
        category: 'Fit Out'
      }
    ]
  }
];

// Helper functions
export function getTemplatesByCategory(category: ProjectTemplate['category']): ProjectTemplate[] {
  return PROJECT_TEMPLATES.filter(t => t.category === category);
}

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find(t => t.id === id);
}

export function searchTemplates(query: string): ProjectTemplate[] {
  const lowerQuery = query.toLowerCase();
  return PROJECT_TEMPLATES.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.includes(lowerQuery))
  );
}

export function calculateTemplateTotal(template: ProjectTemplate): number {
  return template.lineItems.reduce((sum, item) => {
    return sum + (item.defaultQty * item.estimatedRate);
  }, 0);
}

export function getTemplateCategories(): string[] {
  return [...new Set(PROJECT_TEMPLATES.map(t => t.category))];
}

export function getTemplateSubCategories(category: ProjectTemplate['category']): string[] {
  return [...new Set(
    PROJECT_TEMPLATES
      .filter(t => t.category === category)
      .map(t => t.subCategory)
  )];
}
