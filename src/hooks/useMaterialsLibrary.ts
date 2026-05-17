import { useState, useCallback, useEffect } from 'react';
import { MaterialEntry, MATERIALS_STORAGE_KEY } from '@/lib/materials/types';
import { getUserStorageKey } from '@/lib/localAuth';

function getStorageKey(): string {
  return getUserStorageKey(MATERIALS_STORAGE_KEY);
}

function loadFromStorage(): MaterialEntry[] {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
  } catch {
    return [];
  }
}

function saveToStorage(entries: MaterialEntry[]) {
  localStorage.setItem(getStorageKey(), JSON.stringify(entries));
}

export function useMaterialsLibrary() {
  const [materials, setMaterials] = useState<MaterialEntry[]>(loadFromStorage);

  const persist = useCallback((next: MaterialEntry[]) => {
    setMaterials(next);
    saveToStorage(next);
  }, []);

  const addMaterial = useCallback((entry: Omit<MaterialEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newEntry: MaterialEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    persist([...loadFromStorage(), newEntry]);
    return newEntry;
  }, [persist]);

  const updateMaterial = useCallback((id: string, updates: Partial<Omit<MaterialEntry, 'id' | 'createdAt'>>) => {
    const current = loadFromStorage();
    const next = current.map(m =>
      m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
    );
    persist(next);
  }, [persist]);

  const deleteMaterial = useCallback((id: string) => {
    persist(loadFromStorage().filter(m => m.id !== id));
  }, [persist]);

  const importFromCSV = useCallback((csv: string): number => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return 0;
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const now = new Date().toISOString();
    const imported: MaterialEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      if (cols.every(c => !c)) continue;
      const get = (key: string) => cols[headers.indexOf(key)] || '';
      const costRaw = parseFloat(get('unit cost') || get('unitcost') || get('cost') || '0');
      const leadRaw = parseInt(get('lead time') || get('leadtime') || get('lead') || '0', 10);
      imported.push({
        id: crypto.randomUUID(),
        name: get('name') || get('material') || get('description') || `Item ${i}`,
        trade: get('trade') || get('category') || 'General',
        unit: get('unit') || 'ea',
        unitCost: isNaN(costRaw) ? 0 : costRaw,
        supplierName: get('supplier') || get('supplier name') || '',
        supplierType: (get('type') || get('supplier type') || '').toLowerCase().includes('overseas') ? 'overseas' : 'local',
        leadTimeWeeks: isNaN(leadRaw) || leadRaw === 0 ? null : leadRaw,
        productCode: get('code') || get('product code') || get('sku') || '',
        notes: get('notes') || get('note') || '',
        createdAt: now,
        updatedAt: now,
      });
    }

    if (imported.length > 0) {
      persist([...loadFromStorage(), ...imported]);
    }
    return imported.length;
  }, [persist]);

  const exportToCSV = useCallback(() => {
    const current = loadFromStorage();
    const headers = ['Name', 'Trade', 'Unit', 'Unit Cost', 'Supplier', 'Type', 'Lead Time (wks)', 'Product Code', 'Notes'];
    const rows = current.map(m => [
      m.name, m.trade, m.unit, m.unitCost.toString(),
      m.supplierName, m.supplierType,
      m.leadTimeWeeks?.toString() || '',
      m.productCode, m.notes,
    ].map(v => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `materials-library-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Sync across tabs
  useEffect(() => {
    const key = getStorageKey();
    const handler = (e: StorageEvent) => {
      if (e.key === key) {
        setMaterials(loadFromStorage());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { materials, addMaterial, updateMaterial, deleteMaterial, importFromCSV, exportToCSV };
}
