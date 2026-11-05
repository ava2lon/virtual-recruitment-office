-- Shared SAML request-ID cache for multi-instance serverless deployments.
create table if not exists public.saml_request_cache (
  request_id text primary key,
  cache_value text not null,
  created_at_ms bigint not null,
  expires_at timestamptz not null
);

alter table public.saml_request_cache enable row level security;
revoke all on public.saml_request_cache from public, anon, authenticated;
grant all on public.saml_request_cache to service_role;

create index if not exists saml_request_cache_expiry_idx
  on public.saml_request_cache (expires_at);
