-- PII-safe failure records for recruitment n8n workflows.
-- Intentionally no anon/authenticated policies: only the server-side service role should access this table.

create table if not exists public.workflow_failures (
  id uuid primary key default gen_random_uuid(),
  workflow_name text not null,
  workflow_id text,
  execution_id text,
  failed_node text,
  error_message text not null,
  error_stack text,
  execution_url text,
  occurred_at timestamptz not null default now(),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'ignored')),
  retry_count integer not null default 0 check (retry_count >= 0),
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists workflow_failures_open_recent_idx
  on public.workflow_failures (occurred_at desc)
  where status = 'open';

create index if not exists workflow_failures_execution_id_idx
  on public.workflow_failures (execution_id)
  where execution_id is not null;

alter table public.workflow_failures enable row level security;
revoke all on table public.workflow_failures from anon, authenticated;
grant all on table public.workflow_failures to service_role;

comment on table public.workflow_failures is
  'Server-only, PII-minimized error records from recruitment automation workflows. Do not store CVs, candidate payloads, or full execution input.';
