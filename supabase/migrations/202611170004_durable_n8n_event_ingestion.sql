create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

alter table public.workflow_events enable row level security;
revoke all on public.workflow_events from public, anon, authenticated;
grant all on public.workflow_events to service_role;

create unique index if not exists workflow_events_event_idempotency_uidx
  on public.workflow_events (event, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists workflow_dead_letters_event_idempotency_uidx
  on public.workflow_dead_letters (event, idempotency_key)
  where idempotency_key is not null;

create index if not exists workflow_events_received_at_idx
  on public.workflow_events (received_at desc);
