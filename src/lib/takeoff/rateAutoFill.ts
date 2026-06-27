import { SCOPE_OF_WORK_RATES, type AustralianState } from '@/data/scopeOfWorkRates';

// Maps logical item keys to rate IDs in SCOPE_OF_WORK_RATES
const RATE_MAP: Record<string, string> = {
  'framing':          'carp-011',   // Wall framing per m² (supply + install)
  'lining_pb':        'plas-002',   // Plasterboard walls
  'lining_fc':        'clad-002',   // FC sheet lining
  'insulation':       'insul-002',  // Wall batts R2.0
  'ceiling':          'plas-001',   // Plasterboard ceiling
  'roofing':          'roof-001',   // Colorbond metal roofing
  'tiling':           'tile-001',   // Floor tiling porcelain
  'painting':         'paint-001',  // Interior walls 2 coats
  'cladding':         'clad-002',   // FC sheet external
  'door':             'carp-006',   // Internal door hang
  'window':           'carp-008',   // Window frame install
  'floor':            'tile-001',   // Default floor finish (tiling)
  'concrete_slab':    'conc-001',   // Concrete slab pour
  'demolition':       'demo-004',   // Timber structure removal
  'waterproofing':    'wproof-002', // Balcony membrane
  'brickwork':        'brick-001',  // Standard bricklaying
};

function lookupRate(key: string, state: AustralianState): number {
  const rateId = RATE_MAP[key];
  if (!rateId) return 0;
  const row = SCOPE_OF_WORK_RATES.find(r => r.id === rateId);
  if (!row) return 0;
  return (row as any)[state] ?? row['QLD'] ?? 0;
}

export function getFramingRate(state: AustralianState): number {
  return lookupRate('framing', state);
}

export function getLiningRate(liningType: string | undefined, state: AustralianState): number {
  const key = liningType?.startsWith('fc') ? 'lining_fc' : 'lining_pb';
  return lookupRate(key, state);
}

export function getInsulationRate(state: AustralianState): number {
  return lookupRate('insulation', state);
}

export function getMeasurementTypeRate(
  measurementType: string | undefined,
  unit: string,
  isConcreteFloor: boolean,
  state: AustralianState
): number {
  if (isConcreteFloor) return lookupRate('concrete_slab', state);

  switch (measurementType) {
    case 'Ceiling':       return lookupRate('ceiling', state);
    case 'Roofing':       return lookupRate('roofing', state);
    case 'Tiling':        return lookupRate('tiling', state);
    case 'Painting':      return lookupRate('painting', state);
    case 'Cladding':      return lookupRate('cladding', state);
    case 'Door':          return unit === 'EA' ? lookupRate('door', state) : 0;
    case 'Window':        return unit === 'EA' ? lookupRate('window', state) : 0;
    case 'Floor':         return lookupRate('floor', state);
    case 'Demolition':    return lookupRate('demolition', state);
    case 'Waterproofing': return lookupRate('waterproofing', state);
    case 'Brickwork':     return lookupRate('brickwork', state);
    case 'Concrete Slab': return lookupRate('concrete_slab', state);
    default:              return 0;
  }
}
