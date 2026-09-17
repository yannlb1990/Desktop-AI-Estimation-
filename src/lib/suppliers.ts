import { supabase } from '@/integrations/supabase/client';

export interface SavedSupplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  trades: string[];
  state?: string;
}

function rowToSaved(row: {
  id: string;
  business_name: string;
  email: string;
  phone: string;
  state: string;
  categories: string[];
}): SavedSupplier {
  return {
    id: row.id,
    name: row.business_name,
    email: row.email,
    phone: row.phone || undefined,
    trades: row.categories || [],
    state: row.state || undefined,
  };
}

const LS_CACHE_KEY = 'metricore_suppliers_cache';

export async function loadSuppliers(): Promise<SavedSupplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, business_name, email, phone, state, categories')
    .order('business_name');

  if (error) {
    // fallback to cached data so the UI doesn't break on transient errors
    try {
      const raw = localStorage.getItem(LS_CACHE_KEY);
      return raw ? (JSON.parse(raw) as SavedSupplier[]) : [];
    } catch { return []; }
  }

  const result = (data ?? []).map(rowToSaved);
  localStorage.setItem(LS_CACHE_KEY, JSON.stringify(result));
  return result;
}

export async function addSupplier(s: Omit<SavedSupplier, 'id'>): Promise<SavedSupplier> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      business_name: s.name,
      contact_name: s.name,
      email: s.email,
      phone: s.phone || '',
      state: s.state || '',
      categories: s.trades,
      user_id: user.id,
    })
    .select('id, business_name, email, phone, state, categories')
    .single();

  if (error) throw error;
  return rowToSaved(data);
}

export async function removeSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw error;
}
