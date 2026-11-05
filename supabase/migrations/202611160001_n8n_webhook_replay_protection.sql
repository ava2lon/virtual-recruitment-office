-- Replay protection for signed inbound n8n callbacks.
-- Nonces are SHA-256 hashes only; raw nonce values are never persisted.
create table if not exists public.n8n_webhook_nonces (
  nonce_hash text primary key
    check (nonce_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.n8n_webhook_nonces enable row level security;
revoke all on public.n8n_webhook_nonces from public, anon, authenticated;
grant all on public.n8n_webhook_nonces to service_role;

create index if not exists n8n_webhook_nonces_expiry_idx
  on public.n8n_webhook_nonces (expires_at);
