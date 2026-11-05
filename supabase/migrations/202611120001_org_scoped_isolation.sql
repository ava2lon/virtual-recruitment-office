-- Add organization scoping to core recruitment tables.
alter table public.jobs
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.applications
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.conversations
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists jobs_org_idx on public.jobs (organization_id);
create index if not exists applications_org_idx on public.applications (organization_id);
create index if not exists conversations_org_idx on public.conversations (organization_id);

-- Helper: is the current user a member of the given org?
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_org_id and om.user_id = auth.uid()
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
grant execute on function private.is_org_member(uuid) to authenticated;

-- Jobs: scope read/write to org members (or owner with no org for legacy).
drop policy if exists "jobs read by org members" on public.jobs;
create policy "jobs read by org members" on public.jobs
  for select to authenticated using (
    organization_id is not null and private.is_org_member(organization_id)
  );

-- Applications: scope by org.
drop policy if exists "applications read by org members" on public.applications;
create policy "applications read by org members" on public.applications
  for select to authenticated using (
    organization_id is not null and private.is_org_member(organization_id)
  );

-- Organization-scoped conversations are readable by members of that organization.
-- Unscoped legacy conversations remain governed by participant-level policies.
drop policy if exists "conversations read by org members" on public.conversations;
create policy "conversations read by org members" on public.conversations
  for select to authenticated using (
    organization_id is not null and private.is_org_member(organization_id)
  );
