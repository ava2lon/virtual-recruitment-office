create table if not exists public.user_mfa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  totp_secret text not null,
  enabled boolean not null default false,
  recovery_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_mfa enable row level security;

drop policy if exists "user_mfa read own" on public.user_mfa;
create policy "user_mfa read own" on public.user_mfa
  for select to authenticated using (user_id = auth.uid());

revoke all on public.user_mfa from anon, authenticated;
grant all on public.user_mfa to service_role;
