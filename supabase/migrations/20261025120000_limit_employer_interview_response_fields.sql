-- Return only approved interview, application, job, and candidate fields to employer RPC callers.
-- Avoid serializing complete rows, which can expose recruiter notes, AI screening data,
-- scores, or future columns added to these tables.
create or replace function public.get_employer_interviews()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_role text;
begin
  select role::text
    into v_role
  from public.profiles
  where id = v_user;

  if v_user is null or v_role is null or v_role <> 'employer' then
    raise exception 'forbidden';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'application_id', i.application_id,
        'interviewer', i.interviewer,
        'scheduled_at', i.scheduled_at,
        'meeting_url', i.meeting_url,
        'status', i.status,
        'feedback', i.feedback,
        'created_at', i.created_at,
        'updated_at', i.updated_at,
        'application', jsonb_build_object(
          'id', a.id,
          'job_id', a.job_id,
          'status', a.status,
          'candidate_applied', a.candidate_applied,
          'created_at', a.created_at,
          'updated_at', a.updated_at
        ),
        'job', jsonb_build_object(
          'id', j.id,
          'company_id', j.company_id,
          'job_title', j.job_title,
          'location', j.location,
          'employment_type', j.employment_type,
          'status', j.status
        ),
        'candidate', jsonb_build_object(
          'first_name', c.first_name,
          'last_name', c.last_name,
          'location', c.location,
          'years_experience', c.years_experience
        )
      )
      order by i.scheduled_at
    )
    from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    join public.candidates c on c.id = a.candidate_id
    where public.is_company_member(j.company_id)
  ), '[]'::jsonb);
end;
$function$;
