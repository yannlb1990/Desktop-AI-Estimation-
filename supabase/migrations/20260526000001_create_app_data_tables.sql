-- ============================================================
-- App data tables — ready for localStorage → Supabase migration
-- All tables mirror the exact shape of localStorage objects.
-- RLS: users can only access their own rows.
-- ============================================================

-- ── 1. projects ───────────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:local_projects`  (array of project objects)
-- Each project embeds estimate_items, consumables, estimate_config, estimate_totals
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- core fields
  name            text not null,
  client_name     text,
  site_address    text,
  address         text,
  state           text default 'NSW',
  postcode        text default '0000',
  plan_file_name  text,
  status          text not null default 'in_progress',   -- in_progress | complete | archived

  -- estimate configuration (was estimate_config blob)
  grouping_mode       text not null default 'none',      -- none | trade | room
  overhead_total      numeric(12,2) not null default 0,
  labour_rates        jsonb not null default '{}',
  custom_configs      jsonb not null default '{}',

  -- summary totals (denormalised for fast dashboard queries)
  total_materials     numeric(12,2) not null default 0,
  total_labour        numeric(12,2) not null default 0,
  total_markup        numeric(12,2) not null default 0,
  grand_total         numeric(12,2) not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

create policy "Users manage their own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 2. estimate_items ─────────────────────────────────────────────────────────
-- Replaces: project.estimate_items  (array embedded in each project)
-- Mirrors EstimateItem interface in EstimateTemplate.tsx exactly
create table if not exists public.estimate_items (
  id                   text primary key,   -- kept as text to preserve existing UUIDs
  project_id           uuid not null references public.projects(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,

  section_id           text,
  item_number          text,
  area                 text not null default '',
  trade                text not null default '',
  scope_of_work        text not null default '',
  material_type        text not null default '',
  quantity             numeric(12,4) not null default 0,
  unit                 text not null default 'm²',
  unit_price           numeric(12,4) not null default 0,
  labour_hours         numeric(10,4) not null default 0,
  labour_rate          numeric(10,4) not null default 0,
  material_wastage_pct numeric(6,4) not null default 0,
  labour_wastage_pct   numeric(6,4) not null default 0,
  markup_pct           numeric(6,4) not null default 0,
  notes                text not null default '',
  product_url          text,
  related_materials    jsonb not null default '[]',

  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index on public.estimate_items (project_id);
create index on public.estimate_items (user_id);

create trigger estimate_items_updated_at
  before update on public.estimate_items
  for each row execute function public.set_updated_at();

alter table public.estimate_items enable row level security;

create policy "Users manage their own estimate items"
  on public.estimate_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 3. consumables ────────────────────────────────────────────────────────────
-- Replaces: project.consumables  (array embedded in each project)
-- Mirrors ConsumableItem interface in EstimateTemplate.tsx
create table if not exists public.consumables (
  id          text primary key,
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,

  name        text not null,
  quantity    numeric(12,4) not null default 0,
  unit        text not null default 'ea',
  unit_price  numeric(12,4) not null default 0,

  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index on public.consumables (project_id);

alter table public.consumables enable row level security;

create policy "Users manage their own consumables"
  on public.consumables for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 4. clients ────────────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:local_clients`
-- Mirrors Client interface in Clients.tsx exactly
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  contact_name  text not null,
  company_name  text,
  email         text not null,
  phone         text,
  mobile        text,
  city          text,
  state         text,
  client_type   text,   -- residential | commercial | industrial | etc.

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on public.clients (user_id);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "Users manage their own clients"
  on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 5. materials_library ──────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:user_materials_library`
-- Mirrors MaterialEntry interface in src/lib/materials/types.ts exactly
create table if not exists public.materials_library (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  name              text not null,
  trade             text not null,
  unit              text not null,
  unit_cost         numeric(12,4) not null default 0,
  supplier_name     text not null default '',
  supplier_type     text not null default 'local',  -- local | overseas
  lead_time_weeks   integer,
  product_code      text not null default '',
  notes             text not null default '',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.materials_library (user_id);

create trigger materials_library_updated_at
  before update on public.materials_library
  for each row execute function public.set_updated_at();

alter table public.materials_library enable row level security;

create policy "Users manage their own materials library"
  on public.materials_library for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 6. default_rates ─────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:default_rates`
-- One row per user storing their saved labour rate defaults
create table if not exists public.default_rates (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  rates       jsonb not null default '{}',
  updated_at  timestamptz not null default now()
);

alter table public.default_rates enable row level security;

create policy "Users manage their own default rates"
  on public.default_rates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 7. labour_presets ────────────────────────────────────────────────────────
-- Replaces: localStorage key  `{email}:labour_presets`
-- Named sets of labour rates a user has saved
create table if not exists public.labour_presets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  rates       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index on public.labour_presets (user_id);

alter table public.labour_presets enable row level security;

create policy "Users manage their own labour presets"
  on public.labour_presets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── 8. project_files ─────────────────────────────────────────────────────────
-- New table — plan PDFs and site photos stored in Supabase Storage.
-- Bucket name: 'project-files'  (create in dashboard or via Storage API)
create table if not exists public.project_files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,

  file_name     text not null,
  storage_path  text not null,   -- path inside the 'project-files' bucket
  file_type     text not null,   -- plan_pdf | site_photo | export_pdf | other
  file_size     bigint,
  mime_type     text,

  created_at    timestamptz not null default now()
);

create index on public.project_files (project_id);

alter table public.project_files enable row level security;

create policy "Users manage their own project files"
  on public.project_files for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
