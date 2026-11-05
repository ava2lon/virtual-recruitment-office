-- One-time, server-only WebAuthn challenges prevent replay across requests.
create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_hash text not null unique,
  user_id uuid references public.users(id) on delete cascade,
  purpose text not null check (purpose in ('registration','authentication')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.webauthn_challenges enable row level security;
revoke all on public.webauthn_challenges from public, anon, authenticated;
grant all on public.webauthn_challenges to service_role;

create index if not exists webauthn_challenges_expiry_idx
  on public.webauthn_challenges (expires_at)
  where consumed_at is null;
