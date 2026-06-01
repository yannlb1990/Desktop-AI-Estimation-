-- ============================================================
-- Takeoff & remaining project data tables
-- Covers everything left in localStorage not in migration 000001.
-- All JSONB fields mirror the exact TypeScript interface shapes
-- so migration is a direct JSON.parse → insert with no transforms.
-- ============================================================

-- ── 1. takeoff_sessions ───────────────────────────────────────────────────────
-- Replaces: localStorage key  `takeoff_{projectId}`
-- Mirrors PersistedState in src/hooks/useTakeoffState.ts
-- measurements and costItems stored as JSONB arrays (same shape as localStorage)
-- so migration = one INSERT per project, zero field mapping.
create table if not exists public.takeoff_sessions (
  project_id      uuid primary key references public.projects(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- plan metadata
  plan_id         text,          -- name+size fingerprint, survives blob URL expiry
  pdf_name        text,
  pdf_url         text,          -- Supabase Storage https:// URL only
  pdf_page_count  integer,

  -- full arrays stored as JSONB (matches Measurement[] and CostItem[] exactly)
  measurements    jsonb not null default '[]',
  cost_items      jsonb not null default '[]',

  -- scales: Record<pageIndex, ScaleData> — stored as JSONB object
  scales          jsonb not null default '{}',

  updated_at      timestamptz not null default now()
);

create index on public.takeoff_sessions (user_id);

create trigger takeoff_sessions_updated_at
  before update on public.takeoff_sessions
  for each row execute function public.set_updated_at();

alter table public.takeoff_sessions enable row level security;

create policy "Users manage their own takeoff sessions"
  on public.takeoff_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 2. overhead_items ─────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:overhead_items_{projectId}`
-- Mirrors OverheadItem interface in OverheadManager.tsx
create table if not exists public.overhead_items (
  id          text primary key,
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,

  name        text not null,
  category    text not null,
  amount      numeric(12,2) not null default 0,
  frequency   text not null default 'once',
  notes       text not null default '',

  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index on public.overhead_items (project_id);

alter table public.overhead_items enable row level security;

create policy "Users manage their own overhead items"
  on public.overhead_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 3. overhead_templates ─────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:overhead_templates`
-- Mirrors OverheadTemplate interface in OverheadManager.tsx
create table if not exists public.overhead_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  name        text not null,
  category    text not null,
  amount      numeric(12,2) not null default 0,
  frequency   text not null default 'once',
  notes       text not null default '',

  created_at  timestamptz not null default now()
);

create index on public.overhead_templates (user_id);

alter table public.overhead_templates enable row level security;

create policy "Users manage their own overhead templates"
  on public.overhead_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 4. subcontractor_quotes ───────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:subcontractor_quotes_{projectId}`
-- Mirrors SubbieQuote interface in SubcontractorComparison.tsx
create table if not exists public.subcontractor_quotes (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,

  trade         text not null,
  company       text not null,
  contact       text,
  phone         text,
  amount        numeric(12,2) not null default 0,
  notes         text,

  submitted_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index on public.subcontractor_quotes (project_id);

alter table public.subcontractor_quotes enable row level security;

create policy "Users manage their own subcontractor quotes"
  on public.subcontractor_quotes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 5. quote_versions ────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:quote_versions_{projectId}`
-- Each version snapshot stores the full QuoteLine[] as JSONB
create table if not exists public.quote_versions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  version_number  integer not null,
  quote_number    text not null default '',
  total           numeric(12,2) not null default 0,
  lines           jsonb not null default '[]',  -- QuoteLine[]

  saved_at        timestamptz not null default now()
);

create index on public.quote_versions (project_id);

alter table public.quote_versions enable row level security;

create policy "Users manage their own quote versions"
  on public.quote_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 6. quote_brand ───────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:quote_brand`
-- One row per user — company branding for generated quotes/tenders
create table if not exists public.quote_brand (
  user_id         uuid primary key references auth.users(id) on delete cascade,

  company_name    text not null default '',
  abn             text not null default '',
  license_number  text not null default '',
  address         text not null default '',
  phone           text not null default '',
  email           text not null default '',
  website         text not null default '',
  logo_url        text,                          -- Supabase Storage URL
  primary_color   text not null default '#1e3a5f',
  secondary_color text not null default '#c8a96e',

  updated_at      timestamptz not null default now()
);

alter table public.quote_brand enable row level security;

create policy "Users manage their own quote brand"
  on public.quote_brand for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 7. quote_settings ────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:quote_settings`
-- Quote generation preferences per user
create table if not exists public.quote_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,

  show_line_items     boolean not null default true,
  show_trade_groups   boolean not null default true,
  show_unit_rates     boolean not null default false,
  gst_enabled         boolean not null default true,
  default_validity_days integer not null default 30,
  default_margin_pct  numeric(6,2) not null default 15,
  payment_terms       text not null default 'Progress claims as per contract',
  default_inclusions  jsonb not null default '[]',
  default_exclusions  jsonb not null default '[]',

  updated_at          timestamptz not null default now()
);

alter table public.quote_settings enable row level security;

create policy "Users manage their own quote settings"
  on public.quote_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 8. tender_documents ──────────────────────────────────────────────────────
-- Replaces: localStorage key  `local_tender_docs_{projectId}`
-- Mirrors TenderDocument interface in TenderDocuments.tsx
-- Note: file_url will point to Supabase Storage on migration
create table if not exists public.tender_documents (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,

  file_name   text not null,
  file_url    text not null,
  file_type   text not null,
  file_size   bigint not null default 0,
  description text,

  created_at  timestamptz not null default now()
);

create index on public.tender_documents (project_id);

alter table public.tender_documents enable row level security;

create policy "Users manage their own tender documents"
  on public.tender_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 9. ncc_compliance ────────────────────────────────────────────────────────
-- Replaces: localStorage key  `ncc_compliance_{projectId}`  (no user scoping in current code)
-- Stores climate zone, state, building class and all check states as JSONB
create table if not exists public.ncc_compliance (
  project_id    uuid primary key references public.projects(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,

  climate_zone  text not null default '6',
  state         text not null default 'NSW',
  building_class text not null default '1a',

  -- check_states: Record<checkId, { status: CheckStatus; notes: string }>
  check_states  jsonb not null default '{}',

  updated_at    timestamptz not null default now()
);

alter table public.ncc_compliance enable row level security;

create policy "Users manage their own NCC compliance"
  on public.ncc_compliance for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 10. cost_estimator_prefs ──────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:cost_estimator_prefs_{projectId}`
-- selectedState, marginPercent, gstEnabled per project
create table if not exists public.cost_estimator_prefs (
  project_id      uuid primary key references public.projects(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  selected_state  text not null default 'NSW',
  margin_percent  numeric(6,2) not null default 15,
  gst_enabled     boolean not null default true,

  updated_at      timestamptz not null default now()
);

alter table public.cost_estimator_prefs enable row level security;

create policy "Users manage their own cost estimator prefs"
  on public.cost_estimator_prefs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 11. cost_estimator_consumables ───────────────────────────────────────────
-- Replaces: localStorage key  `{email}:cost_estimator_consumables_{projectId}`
-- Takeoff-specific consumables (PPE, tools) separate from estimate consumables
create table if not exists public.cost_estimator_consumables (
  id          text primary key,
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,

  name        text not null,
  description text,
  quantity    numeric(12,4) not null default 0,
  unit        text not null default 'ea',
  unit_price  numeric(12,4) not null default 0,

  sort_order  integer not null default 0
);

create index on public.cost_estimator_consumables (project_id);

alter table public.cost_estimator_consumables enable row level security;

create policy "Users manage their own cost estimator consumables"
  on public.cost_estimator_consumables for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 12. estimate_templates ────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:estimate_templates`
-- User-saved cost item templates from CostEstimator
-- Each template stored as JSONB (CostItem shape)
create table if not exists public.estimate_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  name        text not null,
  template    jsonb not null default '{}',   -- full CostItem shape

  created_at  timestamptz not null default now()
);

create index on public.estimate_templates (user_id);

alter table public.estimate_templates enable row level security;

create policy "Users manage their own estimate templates"
  on public.estimate_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 13. project_reminders ────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:project_reminders`
-- Simple reminder notes per project
create table if not exists public.project_reminders (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,

  text        text not null,
  due_date    date,
  completed   boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.project_reminders (project_id);

create trigger project_reminders_updated_at
  before update on public.project_reminders
  for each row execute function public.set_updated_at();

alter table public.project_reminders enable row level security;

create policy "Users manage their own project reminders"
  on public.project_reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 14. app_profile ──────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:app_profile`
-- Mirrors AppProfile interface in src/lib/takeoff/profile.ts
create table if not exists public.app_profile (
  user_id         uuid primary key references auth.users(id) on delete cascade,

  project_type    text not null default 'residential',
  enabled_trades  jsonb not null default '[]',

  updated_at      timestamptz not null default now()
);

alter table public.app_profile enable row level security;

create policy "Users manage their own app profile"
  on public.app_profile for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 15. preferred_suppliers ──────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:preferred_suppliers`
create table if not exists public.preferred_suppliers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  name        text not null,
  trade       text,
  website     text,
  phone       text,
  notes       text,

  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index on public.preferred_suppliers (user_id);

alter table public.preferred_suppliers enable row level security;

create policy "Users manage their own preferred suppliers"
  on public.preferred_suppliers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
