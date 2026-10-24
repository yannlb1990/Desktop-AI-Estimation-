-- Xero: one connection per user (tokens readable only by edge functions, never the browser),
-- and a log of invoices sent, so sending the same claim again updates its draft.

create table if not exists public.xero_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id text not null,
  tenant_name text,
  connection_id text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  account_code text not null default '200',
  due_days integer not null default 10,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.xero_connections enable row level security;
-- no policies: only the service role (edge functions) reads or writes this table

create table if not exists public.xero_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  source_id text not null,             -- the claim (or deposit) record id in Metricore
  tenant_id text not null,
  xero_invoice_id text not null,
  invoice_number text,
  total numeric,
  status text,
  sent_at timestamptz not null default now(),
  unique (user_id, source_id, tenant_id)
);
alter table public.xero_invoices enable row level security;
create policy "own xero invoices readable" on public.xero_invoices for select using (auth.uid() = user_id);
