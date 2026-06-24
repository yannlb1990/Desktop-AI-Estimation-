import { useState, useCallback, useEffect, useRef } from 'react';
import { MaterialEntry, MATERIALS_STORAGE_KEY } from '@/lib/materials/types';
import { getUserStorageKey } from '@/lib/localAuth';
import { supabase } from '@/integrations/supabase/client';

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

function fromRow(row: any): MaterialEntry {
  return {
    id: String(row.id),
    name: row.name,
    trade: row.trade,
    unit: row.unit,
    unitCost: Number(row.unit_cost),
    supplierName: row.supplier_name ?? '',
    supplierType: (row.supplier_type ?? 'local') as 'local' | 'overseas',
    leadTimeWeeks: row.lead_time_weeks ?? null,
    productCode: row.product_code ?? '',
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(entry: MaterialEntry, userId: string) {
  return {
    id: entry.id,
    user_id: userId,
    name: entry.name,
    trade: entry.trade,
    unit: entry.unit,
    unit_cost: entry.unitCost,
    supplier_name: entry.supplierName,
    supplier_type: entry.supplierType,
    lead_time_weeks: entry.leadTimeWeeks,
    product_code: entry.productCode,
    notes: entry.notes,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

export function useMaterialsLibrary() {
  const [materials, setMaterials] = useState<MaterialEntry[]>(loadFromStorage);
  const userIdRef = useRef<string | null>(null);

  // Track current user for cloud operations
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      userIdRef.current = session?.user?.id ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      userIdRef.current = session?.user?.id ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load from Supabase on mount and merge with localStorage
  useEffect(() => {
    let cancelled = false;
    async function loadFromCloud() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        userIdRef.current = session.user.id;

        const { data } = await supabase
          .from('materials_library')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true });

        if (cancelled) return;

        const cloudEntries = (data ?? []).map(fromRow);
        const localEntries = loadFromStorage();
        if (cloudEntries.length === 0 && localEntries.length === 0) return;

        // Merge: union by id, take newer updatedAt
        const cloudMap = new Map(cloudEntries.map(m => [m.id, m]));
        const localMap = new Map(localEntries.map(m => [m.id, m]));
        const allIds = new Set([...cloudMap.keys(), ...localMap.keys()]);
        const merged = [...allIds].map(id => {
          const cloud = cloudMap.get(id);
          const local = localMap.get(id);
          if (!cloud) return local!;
          if (!local) return cloud;
          return new Date(cloud.updatedAt) >= new Date(local.updatedAt) ? cloud : local;
        });

        // Upload any local-only items to cloud
        const localOnly = localEntries.filter(m => !cloudMap.has(m.id));
        if (localOnly.length > 0) {
          supabase.from('materials_library')
            .upsert(localOnly.map(m => toRow(m, session.user.id)))
            .then(({ error }) => {
              if (error) console.warn('[materials] Local→cloud upload failed:', error.message);
            });
        }

        setMaterials(merged);
        saveToStorage(merged);
      } catch (err) {
        console.warn('[materials] Cloud load failed:', err);
      }
    }
    loadFromCloud();
    return () => { cancelled = true; };
  }, []);

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
    const userId = userIdRef.current;
    if (userId) {
      supabase.from('materials_library').insert(toRow(newEntry, userId)).then(({ error }) => {
        if (error) console.warn('[materials] Cloud insert failed:', error.message);
      });
    }
    return newEntry;
  }, [persist]);

  const updateMaterial = useCallback((id: string, updates: Partial<Omit<MaterialEntry, 'id' | 'createdAt'>>) => {
    const now = new Date().toISOString();
    const current = loadFromStorage();
    const next = current.map(m =>
      m.id === id ? { ...m, ...updates, updatedAt: now } : m
    );
    persist(next);
    const userId = userIdRef.current;
    if (userId) {
      const updated = next.find(m => m.id === id);
      if (updated) {
        supabase.from('materials_library').upsert(toRow(updated, userId)).then(({ error }) => {
          if (error) console.warn('[materials] Cloud update failed:', error.message);
        });
      }
    }
  }, [persist]);

  const deleteMaterial = useCallback((id: string) => {
    persist(loadFromStorage().filter(m => m.id !== id));
    const userId = userIdRef.current;
    if (userId) {
      supabase.from('materials_library').delete().eq('id', id).eq('user_id', userId).then(({ error }) => {
        if (error) console.warn('[materials] Cloud delete failed:', error.message);
      });
    }
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
      const merged = [...loadFromStorage(), ...imported];
      persist(merged);
      const userId = userIdRef.current;
      if (userId) {
        supabase.from('materials_library')
          .upsert(imported.map(m => toRow(m, userId)))
          .then(({ error }) => {
            if (error) console.warn('[materials] Cloud bulk import failed:', error.message);
          });
      }
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
