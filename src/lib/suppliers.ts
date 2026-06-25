export interface SavedSupplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  trades: string[];
  state?: string;
}

const STORAGE_KEY = 'metricore_suppliers';

export function loadSuppliers(): SavedSupplier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSupplier[]) : [];
  } catch {
    return [];
  }
}

export function saveSuppliers(suppliers: SavedSupplier[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));
}

export function addSupplier(s: Omit<SavedSupplier, 'id'>): SavedSupplier {
  const supplier: SavedSupplier = { ...s, id: `sup_${Date.now()}_${Math.random().toString(36).slice(2)}` };
  const existing = loadSuppliers();
  saveSuppliers([...existing, supplier]);
  return supplier;
}

export function removeSupplier(id: string): void {
  saveSuppliers(loadSuppliers().filter(s => s.id !== id));
}
