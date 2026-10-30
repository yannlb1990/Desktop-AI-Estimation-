-- A customer's own Claude API key, so AI analyses are billed to their Anthropic account.
-- Stored encrypted (AES-GCM, key only in the edge functions' secrets); no browser access.
create table if not exists public.ai_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'anthropic',
  key_encrypted text not null,
  key_hint text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
alter table public.ai_keys enable row level security;
-- no policies: only the service role (edge functions) can read or write
