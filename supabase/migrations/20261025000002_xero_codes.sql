-- Xero: default account code per kind of invoice line, and the branding theme invoices use
alter table public.xero_connections add column if not exists account_codes jsonb not null default '{}'::jsonb;
alter table public.xero_connections add column if not exists branding_theme_id text;
