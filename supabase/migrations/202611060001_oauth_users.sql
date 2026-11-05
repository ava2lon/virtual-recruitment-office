-- Users and identities for custom OAuth pipeline.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  avatar_url text,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google','facebook')),
  provider_user_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

alter table public.users enable row level security;
alter table public.user_identities enable row level security;

drop policy if exists "users read own" on public.users;
create policy "users read own" on public.users
  for select to authenticated using (id = auth.uid());
drop policy if exists "user_identities read own" on public.user_identities;
create policy "user_identities read own" on public.user_identities
  for select to authenticated using (user_id = auth.uid());

revoke all on public.users from anon;
revoke all on public.user_identities from anon;
grant select on public.users to authenticated;
grant select on public.user_identities to authenticated;
grant select, insert, update on public.users to service_role;
grant select, insert, update, delete on public.user_identities to service_role;
