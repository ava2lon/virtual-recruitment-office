-- Isolated PostgreSQL authorization regression tests.
-- This fixture intentionally models only the columns/functions used by the RPC migrations.
-- It contains synthetic data only and never connects to the production Supabase project.

\set ON_ERROR_STOP on

create schema auth;
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create type public.app_role as enum ('candidate', 'employer', 'recruiter', 'admin');
create type public.application_status as enum ('NEW', 'SCREENING', 'AI_REVIEW', 'RECRUITER_REVIEW', 'SHORTLISTED', 'EMPLOYER_REVIEW', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'PLACED', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE', 'ON_HOLD');
create type public.job_status as enum ('draft', 'open', 'paused', 'closed', 'filled');

create table public.profiles (
  id uuid primary key, email text, first_name text, last_name text, phone text,
  role public.app_role not null, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.companies (
  id uuid primary key default gen_random_uuid(), company_name text not null,
  industry text, website text, contact_email text, phone text,
  status text not null default 'active', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id),
  user_id uuid not null, role text not null, created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  job_title text not null, description text not null, location text, employment_type text,
  salary_min numeric, salary_max numeric, currency text not null default 'NGN',
  required_skills jsonb not null default '[]', preferred_skills jsonb not null default '[]',
  experience_min numeric not null default 0, experience_max numeric, education jsonb not null default '[]',
  ai_analysis jsonb not null default '{}', status public.job_status not null default 'draft',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.candidates (
  id uuid primary key, user_id uuid, first_name text not null, last_name text not null,
  email text not null, phone text, location text, linkedin_url text, portfolio_url text,
  years_experience numeric, availability text, salary_expectation numeric, currency text,
  resume_path text, resume_text text, ai_profile jsonb not null default '{}',
  status text not null default 'active', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), resume_status text not null default 'pending'
);
create table public.applications (
  id uuid primary key, candidate_id uuid not null references public.candidates(id),
  job_id uuid not null references public.jobs(id), source text,
  status public.application_status not null default 'NEW', match_score numeric,
  screening_score numeric, recruiter_score numeric, recruiter_notes text,
  ai_screening jsonb not null default '{}', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), candidate_applied boolean not null default true
);
create table public.interviews (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id),
  interviewer text, scheduled_at timestamptz, meeting_url text,
  status text not null default 'scheduled', feedback text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigserial primary key, actor_user_id uuid, action text not null,
  entity_type text, entity_id uuid, metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create or replace function public.is_company_member(p_company_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.company_members cm
    where cm.company_id = p_company_id and cm.user_id = auth.uid()
  )
$$;

\ir ../supabase/migrations/20261025100000_harden_security_definer_search_path.sql
\ir ../supabase/migrations/20261025110000_scope_interview_scheduling_to_company.sql
\ir ../supabase/migrations/20261025120000_limit_employer_interview_response_fields.sql

insert into public.profiles (id, role) values
('00000000-0000-0000-0000-000000000001','employer'),
('00000000-0000-0000-0000-000000000002','recruiter'),
('00000000-0000-0000-0000-000000000003','admin'),
('00000000-0000-0000-0000-000000000004','candidate'),
('00000000-0000-0000-0000-000000000005','recruiter');

insert into public.companies (id, company_name) values
('10000000-0000-0000-0000-000000000001','Company A'),
('10000000-0000-0000-0000-000000000002','Company B');
insert into public.company_members (company_id,user_id,role) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','owner'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','recruiter'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','recruiter');

insert into public.jobs (id,company_id,job_title,description) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Engineer A','Test job'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Engineer B','Test job');
insert into public.candidates (id,first_name,last_name,email,location,years_experience) values
('30000000-0000-0000-0000-000000000001','Test','Candidate','candidate@example.invalid','Lagos',5);
insert into public.applications (id,candidate_id,job_id,recruiter_notes,ai_screening,match_score,screening_score,recruiter_score) values
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','SECRET NOTES','{"secret":true}',99,88,77),
('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','OTHER SECRET','{"secret":true}',99,88,77);

do $$
declare v_company uuid; v_job uuid; v_result jsonb; v_count integer;
begin
  -- Employer company creation succeeds and creates owner membership.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  v_company := public.employer_create_company('Created by test',null,null,null,null);
  if not exists (select 1 from public.company_members where company_id=v_company and user_id=auth.uid() and role='owner') then
    raise exception 'FAIL: employer company creation did not create owner membership';
  end if;

  -- Candidate cannot create a company.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
  begin
    perform public.employer_create_company('Forbidden',null,null,null,null);
    raise exception 'FAIL: candidate unexpectedly created a company';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like '%forbidden%' then raise; end if;
  end;

  -- Existing company member can create a job; unrelated user cannot.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  v_job := public.employer_create_job('10000000-0000-0000-0000-000000000001','Test role','Test description');
  if not exists (select 1 from public.jobs where id=v_job) then raise exception 'FAIL: authorized job missing'; end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
  begin
    perform public.employer_create_job('10000000-0000-0000-0000-000000000001','Forbidden','No membership');
    raise exception 'FAIL: non-member unexpectedly created a job';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like '%forbidden%' then raise; end if;
  end;

  -- Recruiter belonging to Company A can schedule Company A's application.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  perform public.recruiter_schedule_interview('40000000-0000-0000-0000-000000000001','Recruiter A',now(),null);
  if not exists (select 1 from public.interviews where application_id='40000000-0000-0000-0000-000000000001') then
    raise exception 'FAIL: authorized recruiter scheduling failed';
  end if;

  -- Same recruiter cannot schedule an application owned by Company B.
  begin
    perform public.recruiter_schedule_interview('40000000-0000-0000-0000-000000000002','Recruiter A',now(),null);
    raise exception 'FAIL: cross-company recruiter scheduling unexpectedly succeeded';
  exception when others then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm not like '%forbidden%' then raise; end if;
  end;

  -- Admin retains cross-company scheduling capability.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  perform public.recruiter_schedule_interview('40000000-0000-0000-0000-000000000002','Admin',now(),null);

  -- Employer interview response is company-scoped and excludes private application fields.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  v_result := public.get_employer_interviews();
  if v_result::text like '%SECRET NOTES%' or v_result::text like '%secret%' or
     v_result::text like '%match_score%' or v_result::text like '%screening_score%' or
     v_result::text like '%recruiter_score%' then
    raise exception 'FAIL: private application fields leaked in employer interview response';
  end if;
  if jsonb_array_length(v_result) <> 1 then
    raise exception 'FAIL: employer interview response was not restricted to its company';
  end if;
  raise notice 'PASS: authorization integration tests completed';
end
$$;
