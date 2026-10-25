-- Enforce tenant scope when recruiters schedule interviews.
-- Global admins retain cross-company scheduling; recruiters must belong to the
-- company that owns the job associated with the target application.

create or replace function public.recruiter_schedule_interview(
  p_application_id uuid,
  p_interviewer text,
  p_scheduled_at timestamp with time zone,
  p_meeting_url text default null::text
)
returns public.interviews
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_interview public.interviews;
begin
  select role::text
    into v_role
  from public.profiles
  where id = v_user;

  if v_user is null or v_role is null or v_role not in ('recruiter', 'admin') then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = p_application_id
  ) then
    raise exception 'application_not_found';
  end if;

  if v_role <> 'admin' and not exists (
    select 1
    from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.company_members cm on cm.company_id = j.company_id
    where a.id = p_application_id
      and cm.user_id = v_user
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.interviews (
    application_id, interviewer, scheduled_at, meeting_url, status
  )
  values (
    p_application_id, p_interviewer, p_scheduled_at, p_meeting_url, 'scheduled'
  )
  returning * into v_interview;

  update public.applications
  set status = 'INTERVIEW',
      updated_at = now()
  where id = p_application_id;

  insert into public.audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  )
  values (
    v_user,
    'INTERVIEW_SCHEDULED',
    'interview',
    v_interview.id,
    jsonb_build_object(
      'application_id', p_application_id,
      'scheduled_at', p_scheduled_at
    )
  );

  return v_interview;
end;
$function$;
