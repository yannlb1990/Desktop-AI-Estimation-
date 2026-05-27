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
]
