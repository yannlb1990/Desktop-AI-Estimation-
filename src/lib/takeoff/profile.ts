import { TRADE_OPTIONS } from './types';

export type ProjectType = 'residential' | 'commercial' | 'industrial';

export interface AppProfile {
  projectType: ProjectType;
  enabledTrades: string[];
}

const PROFILE_KEY = 'app_profile';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
};

export const PROJECT_TYPE_PRESETS: Record<ProjectType, string[]> = {
  residential: [
    'Preliminaries', 'Demolition', 'Site Works', 'Concrete',
    'Carpentry', 'Brickwork', 'Roofing', 'Windows & Doors',
    'Waterproofing', 'Plasterboard', 'Joinery', 'Painting',
    'Tiling', 'Floor Coverings', 'Plumbing', 'Electrical',
    'Landscaping', 'General', 'Other',
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
  {
    label: 'Structure & Site',
    trades: ['Preliminaries', 'Site Works', 'Demolition', 'Civil', 'Concrete', 'Formwork', 'Reinforcement', 'Scaffolding'],
  },
  {
    label: 'Envelope',
    trades: ['Structural Steel', 'Metalwork', 'Brickwork', 'Roofing', 'External Cladding', 'External Works', 'Windows & Doors'],
  },
  {
    label: 'Fit-out',
    trades: ['Carpentry', 'Plasterboard', 'Ceilings & Partitions', 'Joinery', 'Waterproofing', 'Tiling', 'Floor Coverings', 'Epoxy Flooring', 'Painting'],
  },
  {
    label: 'Services',
    trades: ['Plumbing', 'Electrical', 'HVAC', 'Fire Services'],
  },
  {
    label: 'Extras',
    trades: ['Landscaping', 'Crane / Lifting', 'Certifications', 'General', 'Other'],
  },
];

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
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppProfile;
      if (parsed.projectType && Array.isArray(parsed.enabledTrades)) return parsed;
    }
  } catch {}
  return { ...DEFAULT_PROFILE, enabledTrades: [...DEFAULT_PROFILE.enabledTrades] };
}

export function saveProfile(profile: AppProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
