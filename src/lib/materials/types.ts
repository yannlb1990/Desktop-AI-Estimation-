export interface MaterialEntry {
  id: string;
  name: string;
  trade: string;
  unit: string;
  unitCost: number;
  supplierName: string;
  supplierType: 'local' | 'overseas';
  leadTimeWeeks: number | null;
  productCode: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const SUPPLIER_TYPES = [
  { value: 'local', label: 'Local' },
  { value: 'overseas', label: 'Overseas' },
] as const;

export const MATERIALS_STORAGE_KEY = 'user_materials_library';
