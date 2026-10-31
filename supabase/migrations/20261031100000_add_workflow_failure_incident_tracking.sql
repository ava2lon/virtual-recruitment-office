-- Add durable incident grouping and notification state to workflow failures.
-- Slack delivery is handled by a separate scheduled n8n workflow. Raw stacks remain
-- server-side and are never included in alert text.

alter table public.workflow_failures
  add column if not exists fingerprint text,
  add column if not exists notified_at timestamptz;

create or replace function public.compute_workflow_failure_fingerprint(
  p_workflow_id text,
  p_failed_node text,
  p_error_message text
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select pg_catalog.md5(
    coalesce(p_workflow_id, '') || pg_catalog.chr(31) ||
    coalesce(p_failed_node, '') || pg_catalog.chr(31) ||
    pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(
              coalesce(p_error_message, ''),
              '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}',
              '<email>',
              'gi'
            ),
            '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}',
            '<uuid>',
            'gi'
          ),
          '(?:sk|pk|api|token)[_-]?[A-Za-z0-9_-]{16,}',
          '<secret>',
          'gi'
        ),
        '[0-9]{7,}',
        '<number>',
        'g'
      )
    )
  );
$function$;

create or replace function public.set_workflow_failure_fingerprint()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.fingerprint := public.compute_workflow_failure_fingerprint(
    new.workflow_id,
    new.failed_node,
    new.error_message
  );
  return new;
end;
$function$;

drop trigger if exists workflow_failures_set_fingerprint
  on public.workflow_failures;

create trigger workflow_failures_set_fingerprint
before insert or update of workflow_id, failed_node, error_message
on public.workflow_failures
for each row
execute function public.set_workflow_failure_fingerprint();

update public.workflow_failures
set fingerprint = public.compute_workflow_failure_fingerprint(
  workflow_id,
  failed_node,
  error_message
)
where fingerprint is null;

create index if not exists workflow_failures_unnotified_open_idx
  on public.workflow_failures (occurred_at desc)
  where status = 'open' and notified_at is null;

revoke all on function public.compute_workflow_failure_fingerprint(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_workflow_failure_fingerprint()
  from public, anon, authenticated, service_role;
