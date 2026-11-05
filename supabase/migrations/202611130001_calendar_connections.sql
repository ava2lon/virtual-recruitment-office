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

create policy if not exists "calendar connections read own" on public.user_calendar_connections
  for select to authenticated using (user_id = auth.uid());
create policy if not exists "calendar connections write own" on public.user_calendar_connections
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.user_calendar_connections from anon;
grant select, insert, update, delete on public.user_calendar_connections to authenticated, service_role;
