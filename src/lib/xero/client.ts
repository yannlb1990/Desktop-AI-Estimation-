/** Browser side of the Xero connection: everything goes through the 'xero' edge function. */
import { supabase } from '@/integrations/supabase/client';

export interface XeroStatus { connected: boolean; tenantName?: string; accountCode?: string; dueDays?: number }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('xero', { body });
  if (error) {
    const msg = await (error as any).context?.json?.().then((j: any) => j?.error).catch(() => null);
    throw new Error(msg || data?.error || 'Xero did not respond: try again');
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const xeroStatus = () => call<XeroStatus>({ action: 'status' });
export const xeroSaveSettings = (accountCode: string, dueDays: number) => call<{ ok: true }>({ action: 'settings', accountCode, dueDays });
export const xeroDisconnect = () => call<{ ok: true }>({ action: 'disconnect' });
export const xeroFinishConnect = (code: string, state: string) => call<{ connected: true; tenantName: string }>({ action: 'callback', code, state });

/** Off to Xero to sign in and pick the organisation; Xero sends the builder back to /xero/callback. */
export async function xeroStartConnect(returnTo = '/settings?tab=xero'): Promise<void> {
  const { url } = await call<{ url: string }>({ action: 'start' });
  try { sessionStorage.setItem('xero_return', returnTo); } catch { /* fine */ }
  window.location.assign(url);
}

export interface XeroInvoiceResult { invoiceId: string; number?: string; total?: number; url: string; updated: boolean }

export const xeroSendInvoice = (p: {
  projectId: string; sourceId: string; contact: { name: string; email?: string };
  reference: string; date: string; lines: { description: string; amount: number }[];
}) => call<XeroInvoiceResult>({ action: 'invoice', ...p });
