-- OAuth tokens are server-only secrets. Do not expose this table through
-- authenticated Data API access, even to the owning user.
create table if not exists public.user_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google','microsoft')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  calendar_id text,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.user_calendar_connections enable row level security;
revoke all on public.user_calendar_connections from public, anon, authenticated;
grant all on public.user_calendar_connections to service_role;
