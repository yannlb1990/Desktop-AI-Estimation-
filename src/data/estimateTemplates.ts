export interface TemplateItem {
  area: string
  trade: string
  scope_of_work: string
  material_type: string
  quantity: number
  unit: string
  unit_price: number
  labour_hours: number
  material_wastage_pct: number
  labour_wastage_pct: number
  markup_pct: number
}

export interface EstimateTemplateData {
  id: string
  name: string
  description: string
  category: 'new-build' | 'renovation' | 'fitout' | 'outdoor'
  icon: string
  items: TemplateItem[]
}

export const ESTIMATE_TEMPLATES: EstimateTemplateData[] = [
  {
    id: 'new-build',
    name: 'New Residential Build',
    description: 'Full house construction from slab to handover — all major trades included',
    category: 'new-build',
    icon: '🏠',
    items: [
      { area: 'Site', trade: 'Concreter', scope_of_work: 'Footings', material_type: 'Concrete 25MPa + rebar', quantity: 80, unit: 'lm', unit_price: 55, labour_hours: 0.4, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Concreter', scope_of_work: 'Slab', material_type: '100mm Concrete slab + mesh', quantity: 180, unit: 'm²', unit_price: 95, labour_hours: 0.5, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Structure', trade: 'Carpenter', scope_of_work: 'Framing', material_type: '90x45 MGP10 Pine framing', quantity: 180, unit: 'm²', unit_price: 58, labour_hours: 1.2, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Structure', trade: 'Carpenter', scope_of_work: 'Cladding', material_type: 'FC Sheet / Weatherboard', quantity: 160, unit: 'm²', unit_price: 45, labour_hours: 0.9, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Carpenter', scope_of_work: 'Fix out', material_type: 'Door sets, skirting, architrave', quantity: 1, unit: 'item', unit_price: 5500, labour_hours: 52, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Roof frame', material_type: 'Prefab trusses 900 c/c', quantity: 200, unit: 'm²', unit_price: 68, labour_hours: 0.8, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Tiles/Metal', material_type: 'Colorbond Custom Orb 0.42bmt', quantity: 220, unit: 'm²', unit_price: 38, labour_hours: 0.6, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Plumber', scope_of_work: 'Rough-in', material_type: 'PEX pipe, copper fittings', quantity: 1, unit: 'item', unit_price: 3800, labour_hours: 42, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Plumber', scope_of_work: 'Fix out', material_type: 'Tapware, fixtures, connections', quantity: 1, unit: 'item', unit_price: 4200, labour_hours: 28, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Plumber', scope_of_work: 'Drainage', material_type: 'PVC drainage, sewer connection', quantity: 1, unit: 'item', unit_price: 2800, labour_hours: 24, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Electrician', scope_of_work: 'Rough-in', material_type: 'PVC conduit, TPS cable', quantity: 1, unit: 'item', unit_price: 3200, labour_hours: 36, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Electrician', scope_of_work: 'Fit-off', material_type: 'Switches, outlets, LED downlights', quantity: 1, unit: 'item', unit_price: 2600, labour_hours: 24, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Plasterer', scope_of_work: 'Internal walls', material_type: '10mm Plasterboard', quantity: 420, unit: 'm²', unit_price: 12.5, labour_hours: 0.45, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Plasterer', scope_of_work: 'Ceilings', material_type: '10mm Plasterboard', quantity: 190, unit: 'm²', unit_price: 12.5, labour_hours: 0.55, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Painter', scope_of_work: 'Interior', material_type: 'Low sheen acrylic — 2 coats', quantity: 620, unit: 'm²', unit_price: 5, labour_hours: 0.22, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'External', trade: 'Painter', scope_of_work: 'Exterior', material_type: 'Acrylic — 2 coat system', quantity: 300, unit: 'm²', unit_price: 6.5, labour_hours: 0.3, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Floor tiling', material_type: '600x600 Porcelain', quantity: 65, unit: 'm²', unit_price: 48, labour_hours: 1.2, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Wall tiling', material_type: '300x600 Ceramic', quantity: 42, unit: 'm²', unit_price: 38, labour_hours: 1.4, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'bathroom-reno',
    name: 'Bathroom Renovation',
    description: 'Full bathroom strip-out and fit-out including waterproofing',
    category: 'renovation',
    icon: '🚿',
    items: [
      { area: 'Bathroom', trade: 'Plumber', scope_of_work: 'Rough-in', material_type: 'PEX pipe, copper fittings', quantity: 1, unit: 'item', unit_price: 850, labour_hours: 8, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Bathroom', trade: 'Plumber', scope_of_work: 'Fix out', material_type: 'Tapware, shower rose, connections', quantity: 1, unit: 'item', unit_price: 1200, labour_hours: 6, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Bathroom', trade: 'Tiler', scope_of_work: 'Floor tiling', material_type: '300x300 Non-slip porcelain', quantity: 6, unit: 'm²', unit_price: 48, labour_hours: 1.4, material_wastage_pct: 12, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Bathroom', trade: 'Tiler', scope_of_work: 'Wall tiling', material_type: '300x600 Ceramic wall tile', quantity: 18, unit: 'm²', unit_price: 38, labour_hours: 1.5, material_wastage_pct: 12, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Bathroom', trade: 'Plasterer', scope_of_work: 'Internal walls', material_type: 'Waterproof plasterboard (Villaboard)', quantity: 12, unit: 'm²', unit_price: 22, labour_hours: 0.5, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Bathroom', trade: 'Painter', scope_of_work: 'Interior', material_type: 'Mould-resistant paint — 2 coats', quantity: 20, unit: 'm²', unit_price: 6, labour_hours: 0.3, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'kitchen-reno',
    name: 'Kitchen Renovation',
    description: 'Kitchen strip-out and fit-out including cabinetry and services',
    category: 'renovation',
    icon: '🍳',
    items: [
      { area: 'Kitchen', trade: 'Carpenter', scope_of_work: 'Fix out', material_type: 'Kitchen cabinet carcasses + doors', quantity: 6, unit: 'm', unit_price: 650, labour_hours: 4, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Kitchen', trade: 'Plumber', scope_of_work: 'Rough-in', material_type: 'PEX pipe, copper fittings', quantity: 1, unit: 'item', unit_price: 650, labour_hours: 5, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Kitchen', trade: 'Plumber', scope_of_work: 'Fix out', material_type: 'Sink, tapware, dishwasher connection', quantity: 1, unit: 'item', unit_price: 780, labour_hours: 4, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Kitchen', trade: 'Electrician', scope_of_work: 'Rough-in', material_type: 'TPS cable, conduit', quantity: 1, unit: 'item', unit_price: 480, labour_hours: 4, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Kitchen', trade: 'Electrician', scope_of_work: 'Fit-off', material_type: 'GPOs, LED downlights, rangehood wiring', quantity: 1, unit: 'item', unit_price: 520, labour_hours: 3, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Kitchen', trade: 'Plasterer', scope_of_work: 'Internal walls', material_type: '10mm Plasterboard patch + set', quantity: 8, unit: 'm²', unit_price: 18, labour_hours: 0.6, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Kitchen', trade: 'Tiler', scope_of_work: 'Wall tiling', material_type: 'Subway tile splashback 75x300', quantity: 4, unit: 'm²', unit_price: 52, labour_hours: 1.6, material_wastage_pct: 12, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Kitchen', trade: 'Painter', scope_of_work: 'Interior', material_type: 'Low sheen acrylic — 2 coats', quantity: 35, unit: 'm²', unit_price: 5, labour_hours: 0.22, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'deck-outdoor',
    name: 'Deck / Outdoor Area',
    description: 'Timber or composite deck with footings, framing and finish',
    category: 'outdoor',
    icon: '🌿',
    items: [
      { area: 'Outdoor', trade: 'Concreter', scope_of_work: 'Footings', material_type: 'Concrete piers 300mm dia', quantity: 12, unit: 'ea', unit_price: 85, labour_hours: 1.5, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Outdoor', trade: 'Carpenter', scope_of_work: 'Framing', material_type: '90x45 CCA treated pine bearers & joists', quantity: 40, unit: 'm²', unit_price: 48, labour_hours: 0.9, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Outdoor', trade: 'Carpenter', scope_of_work: 'Decking', material_type: '90x19 Merbau decking — kiln dried', quantity: 40, unit: 'm²', unit_price: 95, labour_hours: 1.1, material_wastage_pct: 12, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Outdoor', trade: 'Carpenter', scope_of_work: 'Stairs', material_type: '240x45 Merbau stringers + treads', quantity: 1, unit: 'item', unit_price: 680, labour_hours: 8, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Outdoor', trade: 'Painter', scope_of_work: 'Exterior', material_type: 'Timber oil — 2 coats', quantity: 40, unit: 'm²', unit_price: 5.5, labour_hours: 0.2, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'commercial-fitout',
    name: 'Commercial Fitout',
    description: 'Office or retail fit-out — partitions, services, finishes',
    category: 'fitout',
    icon: '🏢',
    items: [
      { area: 'General', trade: 'Carpenter', scope_of_work: 'Framing', material_type: '64mm steel stud wall framing', quantity: 80, unit: 'm²', unit_price: 28, labour_hours: 0.7, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'General', trade: 'Carpenter', scope_of_work: 'Fix out', material_type: 'Joinery, shopfront, reception desk', quantity: 1, unit: 'item', unit_price: 8500, labour_hours: 65, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'General', trade: 'Electrician', scope_of_work: 'Rough-in', material_type: 'TPS cable, conduit, DB board', quantity: 1, unit: 'item', unit_price: 4200, labour_hours: 44, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'General', trade: 'Electrician', scope_of_work: 'Fit-off', material_type: 'LED panels, GPOs, data points', quantity: 1, unit: 'item', unit_price: 3800, labour_hours: 32, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'General', trade: 'Plumber', scope_of_work: 'Rough-in', material_type: 'PEX + copper — kitchenette & amenities', quantity: 1, unit: 'item', unit_price: 2400, labour_hours: 24, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'General', trade: 'Plasterer', scope_of_work: 'Internal walls', material_type: '13mm Plasterboard both sides steel stud', quantity: 180, unit: 'm²', unit_price: 13.5, labour_hours: 0.4, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'General', trade: 'Plasterer', scope_of_work: 'Ceilings', material_type: '13mm Plasterboard suspended grid', quantity: 120, unit: 'm²', unit_price: 15, labour_hours: 0.6, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'General', trade: 'Painter', scope_of_work: 'Interior', material_type: 'Low sheen — 2 coat system', quantity: 500, unit: 'm²', unit_price: 5, labour_hours: 0.22, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'General', trade: 'Tiler', scope_of_work: 'Floor tiling', material_type: '600x600 Commercial porcelain', quantity: 90, unit: 'm²', unit_price: 52, labour_hours: 1.1, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },

  // ── Single-trade subcontractor templates ──────────────────────────────────

  {
    id: 'interior-painting',
    name: 'Interior Painting',
    description: 'Residential interior — walls, ceilings, trims and doors',
    category: 'renovation',
    icon: '🖌️',
    items: [
      { area: 'Internal', trade: 'Painter', scope_of_work: 'Surface preparation', material_type: 'Sugar soap wash, fill holes, sand back', quantity: 0, unit: 'm²', unit_price: 2.50, labour_hours: 0.12, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Painter', scope_of_work: 'Primer / sealer — 1 coat', material_type: 'Dulux Prepcoat / Zinsser Bullseye', quantity: 0, unit: 'm²', unit_price: 3.80, labour_hours: 0.15, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Painter', scope_of_work: 'Walls — low sheen acrylic 2 coats', material_type: 'Dulux Wash & Wear low sheen acrylic', quantity: 0, unit: 'm²', unit_price: 5.00, labour_hours: 0.22, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Painter', scope_of_work: 'Ceilings — flat white 2 coats', material_type: 'Dulux Ceiling White flat acrylic', quantity: 0, unit: 'm²', unit_price: 5.50, labour_hours: 0.25, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Painter', scope_of_work: 'Skirtings & architraves — semi-gloss 2 coats', material_type: 'Dulux Aquanamel semi-gloss enamel', quantity: 0, unit: 'lm', unit_price: 8.00, labour_hours: 0.30, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Painter', scope_of_work: 'Door faces — semi-gloss 2 coats', material_type: 'Dulux Aquanamel semi-gloss enamel, both faces', quantity: 0, unit: 'ea', unit_price: 85.00, labour_hours: 1.50, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'floor-wall-tiling',
    name: 'Floor & Wall Tiling',
    description: 'Wet area tiling — waterproofing, floor tiles, wall tiles and trims',
    category: 'renovation',
    icon: '🟦',
    items: [
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Waterproofing — floor (AS 3740)', material_type: 'Laticrete 9235 or Sika Topseal — 2 coats', quantity: 0, unit: 'm²', unit_price: 22.00, labour_hours: 0.35, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Waterproofing — wall upturns 1800mm', material_type: 'Laticrete 9235 or Sika Topseal — 2 coats', quantity: 0, unit: 'm²', unit_price: 22.00, labour_hours: 0.40, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Bond breaker tape — all joints & corners', material_type: '50mm fabric reinforcing tape', quantity: 0, unit: 'lm', unit_price: 7.50, labour_hours: 0.15, material_wastage_pct: 0, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Floor tiling — 600x600 porcelain', material_type: '600x600 Porcelain incl. adhesive + grout', quantity: 0, unit: 'm²', unit_price: 55.00, labour_hours: 1.30, material_wastage_pct: 12, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Wall tiling — 300x600 ceramic', material_type: '300x600 Ceramic incl. adhesive + grout', quantity: 0, unit: 'm²', unit_price: 45.00, labour_hours: 1.50, material_wastage_pct: 12, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Tile trims — aluminium Schluter JOLLY', material_type: 'Schluter JOLLY aluminium edge trim', quantity: 0, unit: 'lm', unit_price: 18.00, labour_hours: 0.20, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Floor waste & shower grate', material_type: 'Stainless floor waste + linear grate', quantity: 0, unit: 'ea', unit_price: 280.00, labour_hours: 1.50, material_wastage_pct: 0, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'plasterboard-lining',
    name: 'Plasterboard Lining',
    description: 'Board, set and cornice — walls, ceilings and wet area lining',
    category: 'renovation',
    icon: '📋',
    items: [
      { area: 'Internal', trade: 'Plasterer', scope_of_work: 'Wall boarding — 10mm plasterboard', material_type: '2400x1200x10mm standard plasterboard', quantity: 0, unit: 'm²', unit_price: 6.50, labour_hours: 0.45, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Plasterer', scope_of_work: 'Ceiling boarding — 10mm plasterboard', material_type: '2400x1200x10mm standard plasterboard', quantity: 0, unit: 'm²', unit_price: 6.50, labour_hours: 0.55, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Plasterer', scope_of_work: 'Wet area lining — Villaboard 9mm', material_type: '2400x1200x9mm James Hardie Villaboard', quantity: 0, unit: 'm²', unit_price: 14.00, labour_hours: 0.50, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Plasterer', scope_of_work: 'Setting — 3-coat set & sand', material_type: 'Joints, screws, internal corners, skim coat', quantity: 0, unit: 'm²', unit_price: 14.00, labour_hours: 0.45, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Plasterer', scope_of_work: 'Cornice — 90mm cove', material_type: 'Gyprock 90mm cove cornice — fixed & set', quantity: 0, unit: 'lm', unit_price: 4.50, labour_hours: 0.25, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'waterproofing-wet-areas',
    name: 'Waterproofing — Wet Areas',
    description: 'AS 3740 compliant waterproofing — showers, bathrooms and laundries',
    category: 'renovation',
    icon: '🛡️',
    items: [
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Surface preparation & primer', material_type: 'Laticrete Primer 254 or equivalent', quantity: 0, unit: 'm²', unit_price: 6.50, labour_hours: 0.15, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Waterproof membrane — floor 2 coats', material_type: 'Laticrete 9235 liquid membrane', quantity: 0, unit: 'm²', unit_price: 18.00, labour_hours: 0.40, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Waterproof membrane — wall upturns 2 coats', material_type: 'Laticrete 9235 liquid membrane', quantity: 0, unit: 'm²', unit_price: 18.00, labour_hours: 0.45, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Bond breaker tape — junctions & corners', material_type: '50mm fabric bond breaker tape', quantity: 0, unit: 'lm', unit_price: 7.50, labour_hours: 0.15, material_wastage_pct: 0, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Wet Areas', trade: 'Tiler', scope_of_work: 'Flood test & AS 3740 certificate', material_type: '24hr flood test + waterproofing certificate', quantity: 1, unit: 'item', unit_price: 350.00, labour_hours: 2.00, material_wastage_pct: 0, labour_wastage_pct: 0, markup_pct: 15 },
    ],
  },
  {
    id: 'concreting-slab',
    name: 'Concreting — Paths & Slabs',
    description: 'Residential concrete slab, driveway or path — formwork to seal',
    category: 'outdoor',
    icon: '⬜',
    items: [
      { area: 'Site', trade: 'Concreter', scope_of_work: 'Formwork — perimeter', material_type: 'Timber formwork, pegs & bracing', quantity: 0, unit: 'lm', unit_price: 18.00, labour_hours: 0.50, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Concreter', scope_of_work: 'Subgrade preparation & poly underlay', material_type: 'Level, compact, 200µm poly underlay', quantity: 0, unit: 'm²', unit_price: 8.00, labour_hours: 0.20, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Concreter', scope_of_work: 'SL72 mesh reinforcement', material_type: 'SL72 mesh sheets, lapped 225mm', quantity: 0, unit: 'm²', unit_price: 8.50, labour_hours: 0.15, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Concreter', scope_of_work: 'Concrete — 100mm slab 25MPa', material_type: 'Ready-mix 25MPa incl. pump hire', quantity: 0, unit: 'm²', unit_price: 85.00, labour_hours: 0.50, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Concreter', scope_of_work: 'Finish — broom or power trowel', material_type: 'Broom / exposed aggregate / trowel finish', quantity: 0, unit: 'm²', unit_price: 12.00, labour_hours: 0.25, material_wastage_pct: 0, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Site', trade: 'Concreter', scope_of_work: 'Control joints & acrylic sealer', material_type: 'Sawn joints @ 3m centres + sealer coat', quantity: 0, unit: 'm²', unit_price: 6.00, labour_hours: 0.10, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'landscaping',
    name: 'Landscaping',
    description: 'Retaining walls, turf, garden beds and paved paths',
    category: 'outdoor',
    icon: '🌿',
    items: [
      { area: 'External', trade: 'Landscaper', scope_of_work: 'Sleeper retaining wall — 200x75 hardwood', material_type: '200x75mm CCA hardwood sleepers + galv posts', quantity: 0, unit: 'lm', unit_price: 220.00, labour_hours: 3.50, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'External', trade: 'Landscaper', scope_of_work: 'Subgrade excavation & grading', material_type: 'Machine excavation, level & compact', quantity: 0, unit: 'm²', unit_price: 12.00, labour_hours: 0.20, material_wastage_pct: 0, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'External', trade: 'Landscaper', scope_of_work: 'Garden soil — 100mm top-dress', material_type: 'Premium garden soil / sandy loam blend', quantity: 0, unit: 'm²', unit_price: 18.00, labour_hours: 0.20, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'External', trade: 'Landscaper', scope_of_work: 'Turf supply & lay', material_type: 'Sir Walter DNA Certified — incl. top-dress', quantity: 0, unit: 'm²', unit_price: 28.00, labour_hours: 0.30, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'External', trade: 'Landscaper', scope_of_work: 'Concrete mow-strip edging 150x50mm', material_type: 'Concrete mow-strip + formwork', quantity: 0, unit: 'lm', unit_price: 42.00, labour_hours: 0.80, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'External', trade: 'Landscaper', scope_of_work: 'Pebble path / mulch 60mm deep', material_type: 'Pea gravel 10mm or pine mulch 75mm', quantity: 0, unit: 'm²', unit_price: 35.00, labour_hours: 0.40, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'carpentry-fitout',
    name: 'Carpentry Fix-out',
    description: 'Internal joinery — doors, skirtings, wardrobes and window reveals',
    category: 'renovation',
    icon: '🔨',
    items: [
      { area: 'Internal', trade: 'Carpenter', scope_of_work: 'Door sets — supply & hang', material_type: '2040x820 Hume hollow core + hinges + latch', quantity: 0, unit: 'ea', unit_price: 280.00, labour_hours: 2.50, material_wastage_pct: 2, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Carpenter', scope_of_work: 'Skirtings 67mm — supply & fix', material_type: '67x18mm MDF primed skirting, nailed & caulked', quantity: 0, unit: 'lm', unit_price: 6.50, labour_hours: 0.20, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Carpenter', scope_of_work: 'Architraves 42mm — supply & fix', material_type: '42x18mm MDF primed architrave both sides', quantity: 0, unit: 'lm', unit_price: 5.50, labour_hours: 0.20, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Carpenter', scope_of_work: 'Built-in wardrobe — melamine & sliders', material_type: 'Melamine shelving, hanging rail, sliding doors', quantity: 0, unit: 'ea', unit_price: 1100.00, labour_hours: 8.00, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Carpenter', scope_of_work: 'Window reveals & stool — MDF', material_type: 'MDF reveals + painted stool, set & nail', quantity: 0, unit: 'ea', unit_price: 85.00, labour_hours: 1.50, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Internal', trade: 'Carpenter', scope_of_work: 'Linen shelving & miscellaneous fix-out', material_type: 'MDF shelving, brackets, misc joinery items', quantity: 1, unit: 'item', unit_price: 850.00, labour_hours: 10.00, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
  {
    id: 'roofing-metal',
    name: 'Roofing — Metal (Colorbond)',
    description: 'Colorbond metal roof — battens, sheet, ridge, gutters and downpipes',
    category: 'renovation',
    icon: '🏗️',
    items: [
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Roof battens 50x25 CCA — supply & fix', material_type: '50x25mm CCA pine battens @ 900mm centres', quantity: 0, unit: 'lm', unit_price: 3.20, labour_hours: 0.15, material_wastage_pct: 10, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Sarking / underlay', material_type: 'Anticon reflective sisalation underlay', quantity: 0, unit: 'm²', unit_price: 5.50, labour_hours: 0.10, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Colorbond Custom Orb 0.42bmt — supply & fix', material_type: 'Colorbond Custom Orb steel roofing sheet', quantity: 0, unit: 'm²', unit_price: 38.00, labour_hours: 0.60, material_wastage_pct: 8, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Ridge cap & hip cap', material_type: 'Colorbond ridge / hip flashing + screws', quantity: 0, unit: 'lm', unit_price: 28.00, labour_hours: 0.40, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Gutters — Colorbond quad 125mm', material_type: 'Colorbond 125mm quad gutter + brackets', quantity: 0, unit: 'lm', unit_price: 32.00, labour_hours: 0.50, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Downpipes — Colorbond 90mm round', material_type: 'Colorbond 90mm round downpipe + clips + shoes', quantity: 0, unit: 'lm', unit_price: 28.00, labour_hours: 0.40, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
      { area: 'Roof', trade: 'Roofer', scope_of_work: 'Roof screws, sealant & flashings', material_type: 'Hex head screws, silicone, valley flashing', quantity: 0, unit: 'm²', unit_price: 3.50, labour_hours: 0.05, material_wastage_pct: 5, labour_wastage_pct: 5, markup_pct: 15 },
    ],
  },
]
