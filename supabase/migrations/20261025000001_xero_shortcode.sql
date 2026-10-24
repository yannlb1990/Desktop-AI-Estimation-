-- Xero organisation short code: invoice links open in the right organisation
alter table public.xero_connections add column if not exists short_code text;
