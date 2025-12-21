// Australian Scope of Work Market Rates (2025)
// Rates include materials + labour (complete job pricing)
// All 8 states/territories included
// Data Freshness: Updated December 2025

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';

export interface SOWRate {
  id: string;
  trade: string;
  sow: string;
  unit: string;
  NSW: number;
  VIC: number;
  QLD: number;
  SA: number;
  WA: number;
  TAS: number;
  NT: number;
  ACT: number;
  description: string;
  category: string;
  lastUpdated: string;
  source: string;
}

export interface SOWMetadata {
  lastUpdated: string;
  nextUpdate: string;
  dataSource: string;
  version: string;
}

export const SOW_METADATA: SOWMetadata = {
  lastUpdated: '2025-12-01',
  nextUpdate: '2026-03-01', // Quarterly updates
  dataSource: 'Rawlinsons Construction Cost Guide, MBA, Cordell Housing Building Cost Guide',
  version: '2025.4'
};

export const SCOPE_OF_WORK_RATES: SOWRate[] = [
  // CARPENTRY - FRAMING
  { id: "carp-001", trade: "Carpenter", sow: "Wall Framing 90mm", unit: "lm", NSW: 45.00, VIC: 42.00, QLD: 40.00, SA: 38.00, WA: 47.00, TAS: 36.00, NT: 52.00, ACT: 43.00, description: "Frame 90mm stud wall incl materials", category: "Framing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "carp-002", trade: "Carpenter", sow: "Roof Framing Conventional", unit: "m²", NSW: 57.20, VIC: 54.00, QLD: 51.00, SA: 48.00, WA: 60.00, TAS: 46.00, NT: 65.00, ACT: 55.00, description: "Timber roof frame incl battens", category: "Framing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "carp-003", trade: "Carpenter", sow: "Roof Framing Truss", unit: "m²", NSW: 42.50, VIC: 40.00, QLD: 38.00, SA: 36.00, WA: 45.00, TAS: 34.00, NT: 48.00, ACT: 41.00, description: "Truss roof install incl battens", category: "Framing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "carp-004", trade: "Carpenter", sow: "Floor Frame Timber", unit: "m²", NSW: 68.00, VIC: 65.00, QLD: 62.00, SA: 58.00, WA: 72.00, TAS: 56.00, NT: 78.00, ACT: 66.00, description: "Timber floor frame on bearers/joists", category: "Framing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "carp-005", trade: "Carpenter", sow: "Deck Construction Timber", unit: "m²", NSW: 285.00, VIC: 270.00, QLD: 260.00, SA: 250.00, WA: 295.00, TAS: 240.00, NT: 320.00, ACT: 275.00, description: "Complete deck with handrails", category: "External", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // CARPENTRY - FIT OUT
  { id: "carp-006", trade: "Carpenter", sow: "Door Hang Internal", unit: "ea", NSW: 185.00, VIC: 175.00, QLD: 165.00, SA: 158.00, WA: 195.00, TAS: 155.00, NT: 210.00, ACT: 180.00, description: "Supply & hang hollow core door", category: "Fit Out", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "carp-007", trade: "Carpenter", sow: "Door Hang External", unit: "ea", NSW: 425.00, VIC: 400.00, QLD: 380.00, SA: 365.00, WA: 450.00, TAS: 360.00, NT: 480.00, ACT: 410.00, description: "Supply & hang solid timber door", category: "Fit Out", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "carp-008", trade: "Carpenter", sow: "Window Frame Install", unit: "ea", NSW: 320.00, VIC: 300.00, QLD: 285.00, SA: 275.00, WA: 340.00, TAS: 270.00, NT: 365.00, ACT: 310.00, description: "Install aluminium window frame", category: "Fit Out", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "carp-009", trade: "Carpenter", sow: "Skirting & Architraves", unit: "lm", NSW: 18.50, VIC: 17.00, QLD: 16.00, SA: 15.50, WA: 19.50, TAS: 15.00, NT: 21.00, ACT: 18.00, description: "Supply & install 67mm MDF", category: "Fit Out", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "carp-010", trade: "Carpenter", sow: "Cornice Install", unit: "lm", NSW: 16.00, VIC: 15.00, QLD: 14.00, SA: 13.50, WA: 17.00, TAS: 13.00, NT: 18.50, ACT: 15.50, description: "Install 90mm cornice", category: "Fit Out", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // ELECTRICAL
  { id: "elec-001", trade: "Electrician", sow: "Power Point Install", unit: "ea", NSW: 150.60, VIC: 145.00, QLD: 140.00, SA: 135.00, WA: 160.00, TAS: 130.00, NT: 175.00, ACT: 148.00, description: "Supply & install double GPO", category: "First Fix", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "elec-002", trade: "Electrician", sow: "Light Point Install", unit: "ea", NSW: 125.00, VIC: 120.00, QLD: 115.00, SA: 110.00, WA: 132.00, TAS: 108.00, NT: 142.00, ACT: 122.00, description: "Install ceiling light point", category: "First Fix", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "elec-003", trade: "Electrician", sow: "Switch Install", unit: "ea", NSW: 95.00, VIC: 90.00, QLD: 85.00, SA: 82.00, WA: 100.00, TAS: 80.00, NT: 108.00, ACT: 92.00, description: "Supply & install light switch", category: "First Fix", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "elec-004", trade: "Electrician", sow: "Downlight Install", unit: "ea", NSW: 145.00, VIC: 140.00, QLD: 135.00, SA: 130.00, WA: 155.00, TAS: 125.00, NT: 165.00, ACT: 142.00, description: "Supply & install LED downlight", category: "Fit Out", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "elec-005", trade: "Electrician", sow: "Exhaust Fan Install", unit: "ea", NSW: 285.00, VIC: 270.00, QLD: 260.00, SA: 250.00, WA: 300.00, TAS: 245.00, NT: 320.00, ACT: 278.00, description: "Supply & install bathroom exhaust", category: "Fit Out", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "elec-006", trade: "Electrician", sow: "Switchboard Install", unit: "ea", NSW: 1850.00, VIC: 1750.00, QLD: 1650.00, SA: 1580.00, WA: 1950.00, TAS: 1550.00, NT: 2100.00, ACT: 1800.00, description: "Supply & install switchboard", category: "First Fix", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "elec-007", trade: "Electrician", sow: "Meter Box Install", unit: "ea", NSW: 950.00, VIC: 900.00, QLD: 850.00, SA: 820.00, WA: 1000.00, TAS: 800.00, NT: 1080.00, ACT: 925.00, description: "Supply & install meter box", category: "First Fix", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "elec-008", trade: "Electrician", sow: "Smoke Alarm Install", unit: "ea", NSW: 165.00, VIC: 155.00, QLD: 150.00, SA: 145.00, WA: 175.00, TAS: 140.00, NT: 188.00, ACT: 160.00, description: "Supply & install hardwired smoke alarm", category: "Fit Out", lastUpdated: "2025-12-01", source: "MBA" },

  // PLUMBING
  { id: "plum-001", trade: "Plumber", sow: "Rough-in Complete House", unit: "m²", NSW: 89.90, VIC: 85.00, QLD: 80.00, SA: 77.00, WA: 95.00, TAS: 75.00, NT: 102.00, ACT: 87.00, description: "Complete plumbing rough-in", category: "First Fix", lastUpdated: "2025-12-01", source: "HIA" },
  { id: "plum-002", trade: "Plumber", sow: "Toilet Installation", unit: "ea", NSW: 450.00, VIC: 420.00, QLD: 400.00, SA: 385.00, WA: 475.00, TAS: 380.00, NT: 510.00, ACT: 435.00, description: "Supply & install toilet suite", category: "Fit Out", lastUpdated: "2025-12-01", source: "HIA" },
  { id: "plum-003", trade: "Plumber", sow: "Vanity & Basin Install", unit: "ea", NSW: 520.00, VIC: 490.00, QLD: 470.00, SA: 450.00, WA: 550.00, TAS: 440.00, NT: 590.00, ACT: 505.00, description: "Supply & install vanity with basin", category: "Fit Out", lastUpdated: "2025-12-01", source: "HIA" },
  { id: "plum-004", trade: "Plumber", sow: "Kitchen Sink Install", unit: "ea", NSW: 380.00, VIC: 360.00, QLD: 340.00, SA: 325.00, WA: 400.00, TAS: 320.00, NT: 430.00, ACT: 368.00, description: "Supply & install kitchen sink", category: "Fit Out", lastUpdated: "2025-12-01", source: "HIA" },
  { id: "plum-005", trade: "Plumber", sow: "Hot Water System Gas", unit: "ea", NSW: 2850.00, VIC: 2700.00, QLD: 2600.00, SA: 2500.00, WA: 3000.00, TAS: 2450.00, NT: 3200.00, ACT: 2780.00, description: "Supply & install gas HWS", category: "Fit Out", lastUpdated: "2025-12-01", source: "HIA" },
  { id: "plum-006", trade: "Plumber", sow: "Hot Water System Electric", unit: "ea", NSW: 2200.00, VIC: 2100.00, QLD: 2000.00, SA: 1920.00, WA: 2320.00, TAS: 1880.00, NT: 2480.00, ACT: 2140.00, description: "Supply & install electric HWS", category: "Fit Out", lastUpdated: "2025-12-01", source: "HIA" },
  { id: "plum-007", trade: "Plumber", sow: "Rainwater Tank 5000L", unit: "ea", NSW: 3200.00, VIC: 3000.00, QLD: 2900.00, SA: 2800.00, WA: 3380.00, TAS: 2750.00, NT: 3600.00, ACT: 3100.00, description: "Supply & install rainwater tank", category: "External", lastUpdated: "2025-12-01", source: "HIA" },
  { id: "plum-008", trade: "Plumber", sow: "Gas Line Installation", unit: "lm", NSW: 95.00, VIC: 90.00, QLD: 85.00, SA: 82.00, WA: 100.00, TAS: 80.00, NT: 108.00, ACT: 92.00, description: "Install gas line per meter", category: "First Fix", lastUpdated: "2025-12-01", source: "HIA" },

  // BRICKLAYING
  { id: "brick-001", trade: "Bricklayer", sow: "Bricklaying Standard", unit: "m²", NSW: 98.50, VIC: 92.00, QLD: 88.00, SA: 85.00, WA: 105.00, TAS: 82.00, NT: 112.00, ACT: 95.00, description: "Lay standard face brick wall", category: "Structure", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "brick-002", trade: "Bricklayer", sow: "Bricklaying Feature", unit: "m²", NSW: 125.00, VIC: 118.00, QLD: 112.00, SA: 108.00, WA: 132.00, TAS: 105.00, NT: 142.00, ACT: 120.00, description: "Lay feature/textured brick wall", category: "Structure", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "brick-003", trade: "Bricklayer", sow: "Block Work Standard", unit: "m²", NSW: 78.00, VIC: 73.00, QLD: 70.00, SA: 68.00, WA: 82.00, TAS: 65.00, NT: 88.00, ACT: 75.00, description: "Lay concrete blocks", category: "Structure", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "brick-004", trade: "Bricklayer", sow: "Retaining Wall Brick", unit: "m²", NSW: 185.00, VIC: 175.00, QLD: 165.00, SA: 158.00, WA: 195.00, TAS: 155.00, NT: 210.00, ACT: 180.00, description: "Build brick retaining wall", category: "External", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // PLASTERING
  { id: "plas-001", trade: "Plasterer", sow: "Plasterboard Ceiling", unit: "m²", NSW: 28.50, VIC: 26.00, QLD: 25.00, SA: 24.00, WA: 30.00, TAS: 23.00, NT: 32.00, ACT: 27.50, description: "Supply & install ceiling sheets", category: "Lining", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "plas-002", trade: "Plasterer", sow: "Plasterboard Walls", unit: "m²", NSW: 25.00, VIC: 23.00, QLD: 22.00, SA: 21.00, WA: 26.50, TAS: 20.00, NT: 28.00, ACT: 24.00, description: "Supply & install wall sheets", category: "Lining", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "plas-003", trade: "Plasterer", sow: "Plasterboard Stop & Set", unit: "m²", NSW: 19.50, VIC: 18.00, QLD: 17.00, SA: 16.50, WA: 20.50, TAS: 16.00, NT: 22.00, ACT: 19.00, description: "Complete stopping & setting", category: "Lining", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "plas-004", trade: "Plasterer", sow: "Render External Acrylic", unit: "m²", NSW: 75.00, VIC: 70.00, QLD: 68.00, SA: 65.00, WA: 79.00, TAS: 63.00, NT: 85.00, ACT: 72.00, description: "Apply acrylic render system", category: "External", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "plas-005", trade: "Plasterer", sow: "Cornice 90mm", unit: "lm", NSW: 16.00, VIC: 15.00, QLD: 14.00, SA: 13.50, WA: 17.00, TAS: 13.00, NT: 18.00, ACT: 15.50, description: "Install 90mm cornice", category: "Lining", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // PAINTING
  { id: "paint-001", trade: "Painter", sow: "Interior Walls 2 Coats", unit: "m²", NSW: 30.60, VIC: 28.00, QLD: 27.00, SA: 26.00, WA: 32.00, TAS: 25.00, NT: 34.50, ACT: 29.50, description: "Prep & paint 2 coats low sheen", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "paint-002", trade: "Painter", sow: "Ceiling Paint 2 Coats", unit: "m²", NSW: 26.00, VIC: 24.00, QLD: 23.00, SA: 22.00, WA: 27.50, TAS: 21.00, NT: 29.00, ACT: 25.00, description: "Prep & paint 2 coats ceiling white", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "paint-003", trade: "Painter", sow: "Exterior Walls 2 Coats", unit: "m²", NSW: 38.00, VIC: 35.00, QLD: 33.00, SA: 32.00, WA: 40.00, TAS: 30.00, NT: 42.50, ACT: 36.50, description: "Prep & paint 2 coats exterior", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "paint-004", trade: "Painter", sow: "Door Paint Both Sides", unit: "ea", NSW: 145.00, VIC: 135.00, QLD: 130.00, SA: 125.00, WA: 152.00, TAS: 122.00, NT: 162.00, ACT: 140.00, description: "Prep & paint door complete", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "paint-005", trade: "Painter", sow: "Window Frame Paint", unit: "ea", NSW: 125.00, VIC: 115.00, QLD: 110.00, SA: 106.00, WA: 132.00, TAS: 104.00, NT: 140.00, ACT: 120.00, description: "Prep & paint window frame", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // TILING
  { id: "tile-001", trade: "Tiler", sow: "Floor Tiling Supply & Install", unit: "m²", NSW: 101.40, VIC: 95.00, QLD: 90.00, SA: 87.00, WA: 107.00, TAS: 85.00, NT: 115.00, ACT: 98.00, description: "Porcelain floor tiles complete", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "tile-002", trade: "Tiler", sow: "Wall Tiling Supply & Install", unit: "m²", NSW: 95.00, VIC: 90.00, QLD: 85.00, SA: 82.00, WA: 100.00, TAS: 80.00, NT: 108.00, ACT: 92.00, description: "Ceramic wall tiles complete", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "tile-003", trade: "Tiler", sow: "Shower Recess Tiling", unit: "ea", NSW: 1850.00, VIC: 1750.00, QLD: 1650.00, SA: 1580.00, WA: 1950.00, TAS: 1550.00, NT: 2100.00, ACT: 1800.00, description: "Complete shower tiling waterproof", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "tile-004", trade: "Tiler", sow: "Splashback Kitchen", unit: "lm", NSW: 185.00, VIC: 175.00, QLD: 165.00, SA: 158.00, WA: 195.00, TAS: 155.00, NT: 210.00, ACT: 180.00, description: "Kitchen splashback 600mm high", category: "Finishing", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // CONCRETING
  { id: "conc-001", trade: "Concreter", sow: "Slab Pour & Finish", unit: "m²", NSW: 77.20, VIC: 72.00, QLD: 68.00, SA: 65.00, WA: 82.00, TAS: 63.00, NT: 88.00, ACT: 74.00, description: "Pour concrete slab 100mm", category: "Footings", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "conc-002", trade: "Concreter", sow: "Driveway Concrete", unit: "m²", NSW: 95.00, VIC: 90.00, QLD: 85.00, SA: 82.00, WA: 100.00, TAS: 80.00, NT: 108.00, ACT: 92.00, description: "Pour & finish driveway 125mm", category: "External", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "conc-003", trade: "Concreter", sow: "Footings Strip", unit: "lm", NSW: 68.00, VIC: 65.00, QLD: 62.00, SA: 60.00, WA: 72.00, TAS: 58.00, NT: 77.00, ACT: 66.00, description: "Pour strip footings 300x600", category: "Footings", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "conc-004", trade: "Concreter", sow: "Concrete Path", unit: "m²", NSW: 85.00, VIC: 80.00, QLD: 75.00, SA: 72.00, WA: 90.00, TAS: 70.00, NT: 96.00, ACT: 82.00, description: "Pour path 75mm with mesh", category: "External", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // ROOFING
  { id: "roof-001", trade: "Roofer", sow: "Roof Installation Metal", unit: "m²", NSW: 69.60, VIC: 65.00, QLD: 62.00, SA: 60.00, WA: 74.00, TAS: 58.00, NT: 79.00, ACT: 67.00, description: "Install Colorbond roofing", category: "Roofing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "roof-002", trade: "Roofer", sow: "Roof Installation Tiles", unit: "m²", NSW: 95.00, VIC: 90.00, QLD: 85.00, SA: 82.00, WA: 100.00, TAS: 80.00, NT: 108.00, ACT: 92.00, description: "Install concrete roof tiles", category: "Roofing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "roof-003", trade: "Roofer", sow: "Guttering Install", unit: "lm", NSW: 42.00, VIC: 40.00, QLD: 38.00, SA: 36.00, WA: 45.00, TAS: 35.00, NT: 48.00, ACT: 41.00, description: "Install Colorbond guttering", category: "Roofing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "roof-004", trade: "Roofer", sow: "Downpipes Install", unit: "lm", NSW: 38.00, VIC: 36.00, QLD: 34.00, SA: 32.00, WA: 40.00, TAS: 31.00, NT: 43.00, ACT: 37.00, description: "Install Colorbond downpipes", category: "Roofing", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "roof-005", trade: "Roofer", sow: "Fascia & Barge Install", unit: "lm", NSW: 52.00, VIC: 48.00, QLD: 46.00, SA: 44.00, WA: 55.00, TAS: 42.00, NT: 59.00, ACT: 50.00, description: "Install fascia & barge boards", category: "Roofing", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // LANDSCAPING
  { id: "land-001", trade: "Landscaper", sow: "Turf Laying", unit: "m²", NSW: 32.00, VIC: 30.00, QLD: 28.00, SA: 27.00, WA: 34.00, TAS: 26.00, NT: 36.00, ACT: 31.00, description: "Prepare & lay turf", category: "Landscaping", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "land-002", trade: "Landscaper", sow: "Retaining Wall Sleeper", unit: "m²", NSW: 285.00, VIC: 270.00, QLD: 260.00, SA: 250.00, WA: 300.00, TAS: 245.00, NT: 320.00, ACT: 275.00, description: "Timber sleeper retaining wall", category: "Landscaping", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "land-003", trade: "Landscaper", sow: "Paving Supply & Lay", unit: "m²", NSW: 125.00, VIC: 118.00, QLD: 112.00, SA: 108.00, WA: 132.00, TAS: 105.00, NT: 142.00, ACT: 120.00, description: "Concrete pavers laid", category: "Landscaping", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "land-004", trade: "Landscaper", sow: "Garden Bed Preparation", unit: "m²", NSW: 48.00, VIC: 45.00, QLD: 42.00, SA: 40.00, WA: 51.00, TAS: 38.00, NT: 54.00, ACT: 46.00, description: "Prepare garden beds with soil", category: "Landscaping", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "land-005", trade: "Landscaper", sow: "Fence Panel Colorbond", unit: "lm", NSW: 185.00, VIC: 175.00, QLD: 165.00, SA: 158.00, WA: 195.00, TAS: 155.00, NT: 210.00, ACT: 180.00, description: "Install Colorbond fence 1.8m", category: "Landscaping", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // CLADDING
  { id: "clad-001", trade: "Cladding Installer", sow: "Weatherboard Installation", unit: "m²", NSW: 85.00, VIC: 80.00, QLD: 75.00, SA: 72.00, WA: 90.00, TAS: 70.00, NT: 96.00, ACT: 82.00, description: "Install weatherboard cladding", category: "External", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "clad-002", trade: "Cladding Installer", sow: "FC Sheet Cladding", unit: "m²", NSW: 72.00, VIC: 68.00, QLD: 65.00, SA: 62.00, WA: 76.00, TAS: 60.00, NT: 81.00, ACT: 70.00, description: "Install FC sheet cladding", category: "External", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "clad-003", trade: "Cladding Installer", sow: "Brick Veneer", unit: "m²", NSW: 145.00, VIC: 138.00, QLD: 132.00, SA: 126.00, WA: 153.00, TAS: 122.00, NT: 164.00, ACT: 140.00, description: "Install brick veneer", category: "External", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // INSULATION
  { id: "insul-001", trade: "Insulation Installer", sow: "Ceiling Batts R2.5", unit: "m²", NSW: 12.50, VIC: 11.50, QLD: 11.00, SA: 10.50, WA: 13.20, TAS: 10.00, NT: 14.00, ACT: 12.00, description: "Install ceiling batts R2.5", category: "Insulation", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "insul-002", trade: "Insulation Installer", sow: "Wall Batts R2.0", unit: "m²", NSW: 11.00, VIC: 10.00, QLD: 9.50, SA: 9.00, WA: 11.60, TAS: 8.50, NT: 12.30, ACT: 10.50, description: "Install wall batts R2.0", category: "Insulation", lastUpdated: "2025-12-01", source: "Rawlinsons" },
  { id: "insul-003", trade: "Insulation Installer", sow: "Ceiling Batts R4.0", unit: "m²", NSW: 16.50, VIC: 15.50, QLD: 14.80, SA: 14.20, WA: 17.40, TAS: 13.50, NT: 18.50, ACT: 16.00, description: "Install ceiling batts R4.0", category: "Insulation", lastUpdated: "2025-12-01", source: "Rawlinsons" },

  // WATERPROOFING
  { id: "wproof-001", trade: "Waterproofer", sow: "Shower Waterproofing", unit: "ea", NSW: 850.00, VIC: 800.00, QLD: 750.00, SA: 720.00, WA: 900.00, TAS: 700.00, NT: 960.00, ACT: 825.00, description: "Complete shower waterproofing", category: "Waterproofing", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "wproof-002", trade: "Waterproofer", sow: "Balcony Waterproofing", unit: "m²", NSW: 125.00, VIC: 118.00, QLD: 112.00, SA: 108.00, WA: 132.00, TAS: 105.00, NT: 142.00, ACT: 120.00, description: "Balcony membrane system", category: "Waterproofing", lastUpdated: "2025-12-01", source: "MBA" },

  // CABINETRY
  { id: "cab-001", trade: "Cabinetmaker", sow: "Kitchen Standard", unit: "lm", NSW: 1850.00, VIC: 1750.00, QLD: 1650.00, SA: 1580.00, WA: 1950.00, TAS: 1550.00, NT: 2100.00, ACT: 1800.00, description: "Standard kitchen per linear meter", category: "Fit Out", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "cab-002", trade: "Cabinetmaker", sow: "Vanity Custom", unit: "ea", NSW: 1450.00, VIC: 1350.00, QLD: 1300.00, SA: 1250.00, WA: 1530.00, TAS: 1220.00, NT: 1640.00, ACT: 1400.00, description: "Custom bathroom vanity", category: "Fit Out", lastUpdated: "2025-12-01", source: "MBA" },
  { id: "cab-003", trade: "Cabinetmaker", sow: "Built-in Wardrobe", unit: "lm", NSW: 950.00, VIC: 900.00, QLD: 850.00, SA: 820.00, WA: 1000.00, TAS: 800.00, NT: 1080.00, ACT: 920.00, description: "Built-in wardrobe per linear meter", category: "Fit Out", lastUpdated: "2025-12-01", source: "MBA" },
];

// Helper functions
export const getSOWByTrade = (trade: string): SOWRate[] => {
  return SCOPE_OF_WORK_RATES.filter(s => s.trade === trade);
};

export const getSOWByCategory = (category: string): SOWRate[] => {
  return SCOPE_OF_WORK_RATES.filter(s => s.category === category);
};

export const searchSOW = (searchTerm: string): SOWRate[] => {
  const term = searchTerm.toLowerCase();
  return SCOPE_OF_WORK_RATES.filter(s =>
    s.sow.toLowerCase().includes(term) ||
    s.trade.toLowerCase().includes(term) ||
    s.description.toLowerCase().includes(term)
  );
};

export const getSOWCategories = (): string[] => {
  return [...new Set(SCOPE_OF_WORK_RATES.map(s => s.category))];
};

export const getSOWRate = (sowId: string, state: AustralianState): number | null => {
  const sow = SCOPE_OF_WORK_RATES.find(s => s.id === sowId);
  return sow ? sow[state] : null;
};

export const getAllSOWRates = (sowId: string): Record<AustralianState, number> | null => {
  const sow = SCOPE_OF_WORK_RATES.find(s => s.id === sowId);
  if (!sow) return null;

  return {
    NSW: sow.NSW,
    VIC: sow.VIC,
    QLD: sow.QLD,
    SA: sow.SA,
    WA: sow.WA,
    TAS: sow.TAS,
    NT: sow.NT,
    ACT: sow.ACT
  };
};

export const isDataFresh = (): boolean => {
  const lastUpdate = new Date(SOW_METADATA.lastUpdated);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return lastUpdate > sixMonthsAgo;
};

export const getDataAge = (): { days: number; isFresh: boolean } => {
  const lastUpdate = new Date(SOW_METADATA.lastUpdated);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return { days: diffDays, isFresh: diffDays <= 180 };
};

export const getNationalMinMax = (sowId: string): { min: number; max: number; minState: string; maxState: string } | null => {
  const sow = SCOPE_OF_WORK_RATES.find(s => s.id === sowId);
  if (!sow) return null;

  const states: AustralianState[] = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  let min = Infinity, max = -Infinity;
  let minState = '', maxState = '';

  states.forEach(state => {
    const rate = sow[state];
    if (rate < min) { min = rate; minState = state; }
    if (rate > max) { max = rate; maxState = state; }
  });

  return { min, max, minState, maxState };
};
