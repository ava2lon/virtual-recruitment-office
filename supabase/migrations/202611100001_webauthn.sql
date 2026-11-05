create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.webauthn_credentials enable row level security;

drop policy if exists "webauthn read own" on public.webauthn_credentials;
create policy "webauthn read own" on public.webauthn_credentials
  for select to authenticated using (user_id = auth.uid());

revoke all on public.webauthn_credentials from anon, authenticated;
grant all on public.webauthn_credentials to service_role;
