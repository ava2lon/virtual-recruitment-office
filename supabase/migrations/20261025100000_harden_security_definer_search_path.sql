-- Pin SECURITY DEFINER RPC search paths to an empty path.
-- Every application object is explicitly schema-qualified to prevent object-shadowing.
-- Authenticated EXECUTE is retained because these RPCs are part of the signed-in app API;
-- each function continues to enforce its own role/tenant checks.

create or replace function public.employer_create_company(
  p_company_name text,
  p_industry text default null::text,
  p_website text default null::text,
  p_contact_email text default null::text,
  p_phone text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'employer'
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.companies (
    company_name, industry, website, contact_email, phone, status
  )
  values (
    p_company_name, p_industry, p_website, p_contact_email, p_phone, 'active'
  )
  returning id into v_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_id;
end;
$function$;

create or replace function public.employer_create_job(
  p_company_id uuid,
  p_job_title text,
  p_description text,
  p_location text default null::text,
  p_employment_type text default null::text,
  p_salary_min numeric default null::numeric,
  p_salary_max numeric default null::numeric,
  p_currency text default 'NGN'::text,
  p_required_skills jsonb default '[]'::jsonb,
  p_preferred_skills jsonb default '[]'::jsonb,
  p_experience_min numeric default 0,
  p_experience_max numeric default null::numeric,
  p_education jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  if not exists (
    select 1
    from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  insert into public.jobs (
    company_id, job_title, description, location, employment_type,
    salary_min, salary_max, currency, required_skills, preferred_skills,
    experience_min, experience_max, education, ai_analysis, status
  )
  values (
    p_company_id, p_job_title, p_description, p_location, p_employment_type,
    p_salary_min, p_salary_max, p_currency, p_required_skills, p_preferred_skills,
    p_experience_min, p_experience_max, p_education, '{}'::jsonb, 'draft'
  )
  returning id into v_id;

  return v_id;
end;
$function$;

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
      to_jsonb(i) || jsonb_build_object(
        'application', to_jsonb(a),
        'job', to_jsonb(j),
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
    from public.applications
    where id = p_application_id
  ) then
    raise exception 'application_not_found';
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

-- The dashboard RPC already uses an empty search_path and fully qualified names.
