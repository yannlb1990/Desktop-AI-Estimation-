import { TRADE_OPTIONS } from './types';
import { sortTrades } from '@/lib/trades';
import { getUserStorageKey } from '@/lib/localAuth';

export type ProjectType = 'residential' | 'commercial' | 'industrial';

export interface AppProfile {
  projectType: ProjectType;
  enabledTrades: string[];
}

const getProfileKey = () => getUserStorageKey('app_profile');

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
};

export const PROJECT_TYPE_PRESETS: Record<ProjectType, string[]> = {
  residential: [
    'Preliminaries', 'Demolition', 'Site Works', 'Concrete', 'Termite Protection',
    'Carpentry', 'Roofing', 'Windows & Doors', 'Brickwork', 'Cladding', 'Render',
    'Insulation', 'Plasterboard', 'Waterproofing', 'Tiling', 'Joinery',
    'Shower Screens & Mirrors', 'Painting', 'Floor Coverings', 'Plumbing', 'Electrical',
    'HVAC', 'Appliances', 'Balustrades & Metalwork', 'Garage Doors', 'External Works',
    'Fencing', 'Landscaping', 'Scaffolding', 'Waste & Cleaning', 'Certifications',
    'General', 'Other',
  ],
  commercial: [...TRADE_OPTIONS],
  industrial: [
    'Preliminaries', 'Demolition', 'Site Works', 'Concrete',
    'Structural Steel', 'Carpentry', 'Roofing', 'Waterproofing',
    'Epoxy Flooring', 'Plumbing', 'Electrical', 'HVAC',
    'Fire Services', 'Crane / Lifting', 'Certifications',
    'General', 'Other',
  ],
};

// Grouped for the dialog UI
export const TRADE_GROUPS: { label: string; trades: string[] }[] = [
  { label: 'Site and structure', trades: ['Preliminaries', 'Demolition', 'Site Works', 'Concrete', 'Termite Protection', 'Structural Steel', 'Carpentry', 'Scaffolding', 'Crane / Lifting'] },
  { label: 'Envelope', trades: ['Roofing', 'Windows & Doors', 'Brickwork', 'Cladding', 'Render', 'Insulation'] },
  { label: 'Fit-out', trades: ['Plasterboard', 'Waterproofing', 'Tiling', 'Joinery', 'Shower Screens & Mirrors', 'Painting', 'Floor Coverings', 'Epoxy Flooring', 'Appliances', 'Balustrades & Metalwork', 'Garage Doors'] },
  { label: 'Services', trades: ['Plumbing', 'Electrical', 'HVAC', 'Fire Services'] },
  { label: 'External and other', trades: ['External Works', 'Fencing', 'Landscaping', 'Waste & Cleaning', 'Certifications', 'General', 'Other'] },
];

const TRADES_VERSION = 2;
const ADDED_IN_V2 = ['Termite Protection', 'Cladding', 'Render', 'Insulation', 'Shower Screens & Mirrors', 'HVAC', 'Appliances',
  'Balustrades & Metalwork', 'Garage Doors', 'External Works', 'Fencing', 'Scaffolding', 'Waste & Cleaning', 'Certifications'];

export const DEFAULT_PROFILE: AppProfile = {
  projectType: 'residential',
  enabledTrades: PROJECT_TYPE_PRESETS.residential,
};

// Maps the trade name used in scopeOfWorkRates → the TRADE_OPTIONS value
export const RATE_TRADE_TO_OPTION: Record<string, string> = {
  'Carpenter': 'Carpentry',
  'Electrician': 'Electrical',
  'Plumber': 'Plumbing',
  'Tiler': 'Tiling',
  'Painter': 'Painting',
  'Plasterer': 'Plasterboard',
  'Concreter': 'Concrete',
  'Roofer': 'Roofing',
  'Bricklayer': 'Brickwork',
  'Landscaper': 'Landscaping',
  'Structural Steel': 'Structural Steel',
  'HVAC': 'HVAC',
  'Fire': 'Fire Services',
  'Waterproofer': 'Waterproofing',
  'Joiner': 'Joinery',
  'Demolition': 'Demolition',
  'Epoxy': 'Epoxy Flooring',
  'Crane': 'Crane / Lifting',
};

export function loadProfile(): AppProfile {
  try {
    const raw = localStorage.getItem(getProfileKey());
    if (raw) {
      const parsed = JSON.parse(raw) as AppProfile & { tradesVersion?: number };
      if (parsed.projectType && Array.isArray(parsed.enabledTrades)) {
        // Trades added to the list after this profile was saved are switched on for it
        if ((parsed.tradesVersion ?? 1) < TRADES_VERSION) {
          const added = PROJECT_TYPE_PRESETS[parsed.projectType].filter(t => ADDED_IN_V2.includes(t) && !parsed.enabledTrades.includes(t));
          return { projectType: parsed.projectType, enabledTrades: sortTrades([...parsed.enabledTrades, ...added]) };
        }
        return parsed;
      }
    }
  } catch {}
  return { ...DEFAULT_PROFILE, enabledTrades: [...DEFAULT_PROFILE.enabledTrades] };
}

export function saveProfile(profile: AppProfile): void {
  localStorage.setItem(getProfileKey(), JSON.stringify({ ...profile, tradesVersion: TRADES_VERSION }));
}
