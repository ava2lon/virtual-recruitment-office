-- Workflow dead-letter tracking (server-only).
create table if not exists public.workflow_dead_letters (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  error text,
  retry_count integer not null default 0,
  status text not null default 'open' check (status in ('open','retrying','resolved','ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workflow_dead_letters enable row level security;

-- No client policies: service_role only.
revoke all on public.workflow_dead_letters from anon, authenticated;
grant all on public.workflow_dead_letters to service_role;

create index if not exists workflow_dead_letters_status_idx
  on public.workflow_dead_letters (status, created_at desc);
create index if not exists workflow_dead_letters_event_idx
  on public.workflow_dead_letters (event, created_at desc);
