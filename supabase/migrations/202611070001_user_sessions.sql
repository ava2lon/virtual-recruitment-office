-- Session tracking for refresh-token rotation.
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  refresh_token_hash text not null unique,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_sessions enable row level security;

drop policy if exists "user_sessions read own" on public.user_sessions;
create policy "user_sessions read own" on public.user_sessions
  for select to authenticated using (user_id = auth.uid());

revoke all on public.user_sessions from anon, authenticated;
grant all on public.user_sessions to service_role;

create index if not exists user_sessions_user_idx on public.user_sessions (user_id, created_at desc);
create index if not exists user_sessions_hash_idx on public.user_sessions (refresh_token_hash);
