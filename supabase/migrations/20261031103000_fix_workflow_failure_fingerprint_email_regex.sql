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
              '[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}',
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
