/**
 * Company branding for quotes and tenders: logo, colours, tagline, licence, liability and
 * company details. Settings saves it locally (quote_brand) and to the cloud
 * (default_rates.rates.branding / .company). Documents read it through here, refreshed
 * from the cloud each time they open, so a new device or a later edit in Settings shows up.
 */
import { supabase } from '@/integrations/supabase/client';
import { getUserStorageKey } from '@/lib/localAuth';

export interface Brand {
  logo?: string; logoSize?: number; primary?: string; accent?: string; tagline?: string;
  companyName?: string; abn?: string; acn?: string; licence?: string; phone?: string; email?: string;
  address?: string; liability?: string;
}

const KEY = () => getUserStorageKey('quote_brand');

export function loadBrand(): Brand {
  try { return JSON.parse(localStorage.getItem(KEY()) || '{}'); } catch { return {}; }
}

/** Cloud copy merged over the local one (company details from the profile section). */
export async function refreshBrand(): Promise<Brand> {
  const local = loadBrand();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return local;
    const { data } = await (supabase as any).from('default_rates').select('rates').eq('user_id', session.user.id).maybeSingle();
    const b = data?.rates?.branding ?? {};
    const c = data?.rates?.company ?? {};
    const address = [c.address, c.city, c.state, c.postcode].filter(Boolean).join(', ');
    const merged: Brand = {
      ...local,
      // '' counts: a removed logo or cleared tagline must reach every device
      ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined && v !== null)),
      companyName: c.company_name || local.companyName,
      abn: c.abn || local.abn,
      acn: c.acn || local.acn,
      phone: c.phone || local.phone,
      email: c.email || local.email,
      // an address saved on a quote wins over the Settings profile one
      address: b.address || address || local.address,
    };
    localStorage.setItem(KEY(), JSON.stringify(merged));
    return merged;
  } catch { return local; }
}

/**
 * Saved from a document screen: kept locally and in the cloud with Settings. The cloud keeps
 * each section whole (it replaces the section), so read, merge, then write both sections.
 */
export async function saveBrand(b: Brand): Promise<void> {
  localStorage.setItem(KEY(), JSON.stringify({ ...loadBrand(), ...b }));
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { data } = await (supabase as any).from('default_rates').select('rates').eq('user_id', session.user.id).maybeSingle();
    const cloudBrand = data?.rates?.branding ?? {};
    const cloudCompany = data?.rates?.company ?? {};
    const { logo, logoSize, primary, accent, tagline, licence, liability, address } = b;
    await (supabase as any).rpc('merge_default_rates_section', {
      section: 'branding', data: { ...cloudBrand, logo, logoSize, primary, accent, tagline, licence, liability, address },
    });
    await (supabase as any).rpc('merge_default_rates_section', {
      section: 'company',
      data: { ...cloudCompany, company_name: b.companyName ?? cloudCompany.company_name, abn: b.abn ?? cloudCompany.abn, acn: b.acn ?? cloudCompany.acn, phone: b.phone ?? cloudCompany.phone, email: b.email ?? cloudCompany.email },
    });
  } catch { /* local copy still applies */ }
}
