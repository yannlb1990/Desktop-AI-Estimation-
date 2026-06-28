export type FFECategory = 'Appliance' | 'Fixture' | 'Fitting' | 'Furniture' | 'Equipment' | 'Other';
export type FFEStatus = 'Specified' | 'Allowance' | 'TBC' | 'Client Supply';

export interface FFEPhoto {
  id: string;
  localUrl: string;
  supabaseUrl?: string;
  fileName: string;
  uploading?: boolean;
}

export interface FFEItem {
  id: string;
  name: string;
  category: FFECategory;
  quantity: number;
  unit: string;
  supplyCost: number;
  installCost: number;
  supplier: string;
  model: string;
  notes: string;
  status: FFEStatus;
  photos: FFEPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface FFERoom {
  id: string;
  name: string;
  items: FFEItem[];
  order: number;
}

export interface FFESheet {
  projectId: string;
  rooms: FFERoom[];
  updatedAt: string;
}

export const DEFAULT_ROOMS: Omit<FFERoom, 'id'>[] = [
  { name: 'Kitchen', items: [], order: 0 },
  { name: 'Bathrooms', items: [], order: 1 },
  { name: 'Ensuite', items: [], order: 2 },
  { name: 'Master Bedroom', items: [], order: 3 },
  { name: 'Bedrooms', items: [], order: 4 },
  { name: 'Living / Dining', items: [], order: 5 },
  { name: 'Laundry', items: [], order: 6 },
  { name: 'Outdoor / Alfresco', items: [], order: 7 },
  { name: 'Other', items: [], order: 8 },
];

export const CATEGORY_COLORS: Record<FFECategory, string> = {
  Appliance:  'bg-[#E1DCC9]/15 text-[#E1DCC9]/80',
  Fixture:    'bg-[#412D15]/30 text-[#E1DCC9]/75',
  Fitting:    'bg-[#412D15]/25 text-[#E1DCC9]/70',
  Furniture:  'bg-amber-100 text-amber-700',
  Equipment:  'bg-orange-100 text-orange-700',
  Other:      'bg-muted/20 text-muted-foreground',
};

export const STATUS_COLORS: Record<FFEStatus, string> = {
  Specified:      'bg-[#412D15]/20 text-[#E1DCC9]/80',
  Allowance:      'bg-amber-100 text-amber-700',
  TBC:            'bg-orange-100 text-orange-700',
  'Client Supply': 'bg-[#E1DCC9]/15 text-[#E1DCC9]/80',
};
