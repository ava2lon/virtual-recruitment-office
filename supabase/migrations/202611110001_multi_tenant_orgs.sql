create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member','viewer')),
  token text not null unique,
  invited_by uuid references public.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;

-- Members can read their orgs.
drop policy if exists "orgs read by members" on public.organizations;
create policy "orgs read by members"
  on public.organizations
  for select to authenticated using (
    exists (select 1 from public.organization_members om where om.organization_id = organizations.id and om.user_id = auth.uid())
  );
drop policy if exists "orgs insert by authenticated" on public.organizations;
create policy "orgs insert by authenticated"
  on public.organizations
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "org_members read by members" on public.organization_members;
create policy "org_members read by members"
  on public.organization_members
  for select to authenticated using (
    exists (select 1 from public.organization_members om where om.organization_id = organization_members.organization_id and om.user_id = auth.uid())
  );
drop policy if exists "org_members insert by admins" on public.organization_members;
create policy "org_members insert by admins"
  on public.organization_members
  for insert to authenticated with check (
    exists (select 1 from public.organization_members om where om.organization_id = organization_members.organization_id and om.user_id = auth.uid() and om.role in ('owner','admin'))
    or not exists (select 1 from public.organization_members om where om.organization_id = organization_members.organization_id)
  );

drop policy if exists "org_invites read by members" on public.organization_invites;
create policy "org_invites read by members"
  on public.organization_invites
  for select to authenticated using (
    exists (select 1 from public.organization_members om where om.organization_id = organization_invites.organization_id and om.user_id = auth.uid())
    or email = (select email from public.users where id = auth.uid())
  );
drop policy if exists "org_invites insert by admins" on public.organization_invites;
create policy "org_invites insert by admins"
  on public.organization_invites
  for insert to authenticated with check (
    exists (select 1 from public.organization_members om where om.organization_id = organization_invites.organization_id and om.user_id = auth.uid() and om.role in ('owner','admin'))
  );

revoke all on public.organizations, public.organization_members, public.organization_invites from anon;
grant select, insert, update, delete on public.organizations to authenticated, service_role;
grant select, insert, update, delete on public.organization_members to authenticated, service_role;
grant select, insert, update, delete on public.organization_invites to authenticated, service_role;
