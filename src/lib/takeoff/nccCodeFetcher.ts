// NCC Code fetcher utility for Australian building codes

// Default NCC codes by area type
const NCC_CODES_BY_AREA: Record<string, { code: string; description: string }> = {
  'Bathroom': { code: 'F1.7', description: 'Wet areas - waterproofing' },
  'Ensuite': { code: 'F1.7', description: 'Wet areas - waterproofing' },
  'Laundry': { code: 'F1.7', description: 'Wet areas - waterproofing' },
  'WC': { code: 'F1.7', description: 'Wet areas - waterproofing' },
  'Kitchen': { code: 'H4D2', description: 'Floor finishes' },
  'Bedroom': { code: 'H6D3', description: 'Thermal performance' },
  'Living Room': { code: 'H6D3', description: 'Thermal performance' },
  'Dining Room': { code: 'H6D3', description: 'Thermal performance' },
  'Office': { code: 'H6D3', description: 'Thermal performance' },
  'Garage': { code: 'B1D3', description: 'Structural provisions' },
  'Entry': { code: 'D4D3', description: 'Accessibility' },
  'Hallway': { code: 'G5D4', description: 'Fire resistance' },
  'Storage': { code: 'B1D3', description: 'Structural provisions' },
  'Utility': { code: 'B1D3', description: 'Structural provisions' },
  'Patio': { code: 'B1D3', description: 'Structural provisions' },
  'Balcony': { code: 'B1D4', description: 'Balustrades and barriers' },
  'External': { code: 'B1D3', description: 'Structural provisions' },
  'Other': { code: 'B1D2', description: 'General structural' },
};

// Material-specific overrides
const WATERPROOFING_MATERIALS = ['Membrane', 'Sealant', 'Tanking'];
const INSULATION_MATERIALS = ['Batts', 'Foam', 'Reflective'];
const TILE_MATERIALS = ['Tiles'];

export async function fetchNCCCode(
  area: string,
  materials: string[],
  measurementType?: string
): Promise<string> {
  // Check for material-specific overrides first
  const hasWaterproofing = materials.some(m => WATERPROOFING_MATERIALS.includes(m));
  const hasInsulation = materials.some(m => INSULATION_MATERIALS.includes(m));
  const hasTiles = materials.some(m => TILE_MATERIALS.includes(m));

  // Priority: Waterproofing > Insulation > Tiles > Area default
  if (hasWaterproofing) {
    return 'F1.7'; // Wet areas - waterproofing requirement
  }

  if (hasInsulation) {
    return 'H6D3'; // Energy efficiency - thermal performance
  }

  if (hasTiles) {
    return 'H4D2'; // Floor finishes
  }

  // Fall back to area-based code
  const areaCode = NCC_CODES_BY_AREA[area];
  if (areaCode) {
    return areaCode.code;
  }

  // Default fallback
  return 'B1D2';
}

export function getNCCCodeDescription(code: string): string {
  const descriptions: Record<string, string> = {
    'F1.7': 'Wet Areas - Waterproofing Requirements',
    'H4D2': 'Floor Finishes & Materials',
    'H6D3': 'Energy Efficiency - Thermal Performance',
    'B1D3': 'Structural Provisions - General',
    'B1D4': 'Balustrades & Barriers',
    'D4D3': 'Access for People with Disability',
    'G5D4': 'Fire Resistance of Building Elements',
    'B1D2': 'General Structural Requirements',
  };
  return descriptions[code] || 'NCC 2025 Building Code';
}
