-- Xero payments read back: what each sent invoice has been paid
alter table public.xero_invoices add column if not exists amount_paid numeric;
alter table public.xero_invoices add column if not exists amount_due numeric;
alter table public.xero_invoices add column if not exists due_date date;
alter table public.xero_invoices add column if not exists paid_on date;
alter table public.xero_invoices add column if not exists synced_at timestamptz;
