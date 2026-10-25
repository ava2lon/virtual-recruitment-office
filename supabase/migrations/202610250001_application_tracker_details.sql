-- Candidate-private application tracker notes and follow-up reminders.
create table if not exists public.application_tracker_details (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  cv_version text not null default '',
  recruiter_contact text not null default '',
  notes text not null default '',
  next_action text not null default '',
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_tracker_details_candidate_id_idx
  on public.application_tracker_details(candidate_id);

alter table public.application_tracker_details enable row level security;

drop policy if exists "Candidates read own application tracker details" on public.application_tracker_details;
drop policy if exists "Candidates create own application tracker details" on public.application_tracker_details;
drop policy if exists "Candidates update own application tracker details" on public.application_tracker_details;
drop policy if exists "Candidates delete own application tracker details" on public.application_tracker_details;

create policy "Candidates read own application tracker details"
  on public.application_tracker_details for select to authenticated
  using (exists (
    select 1 from public.candidates c
    where c.id = application_tracker_details.candidate_id
      and c.user_id = (select auth.uid())
  ));

create policy "Candidates create own application tracker details"
  on public.application_tracker_details for insert to authenticated
  with check (
    exists (
      select 1 from public.candidates c
      where c.id = application_tracker_details.candidate_id
        and c.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.applications a
      where a.id = application_tracker_details.application_id
        and a.candidate_id = application_tracker_details.candidate_id
    )
  );

create policy "Candidates update own application tracker details"
  on public.application_tracker_details for update to authenticated
  using (exists (
    select 1 from public.candidates c
    where c.id = application_tracker_details.candidate_id
      and c.user_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.candidates c
      where c.id = application_tracker_details.candidate_id
        and c.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.applications a
      where a.id = application_tracker_details.application_id
        and a.candidate_id = application_tracker_details.candidate_id
    )
  );

create policy "Candidates delete own application tracker details"
  on public.application_tracker_details for delete to authenticated
  using (exists (
    select 1 from public.candidates c
    where c.id = application_tracker_details.candidate_id
      and c.user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.application_tracker_details to authenticated;
