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

-- Keep SECURITY DEFINER predicates in a non-exposed schema to avoid
-- recursive RLS lookups without exposing privileged RPC endpoints.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_org_member(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_org_id and om.user_id = auth.uid()
  );
$$;

create or replace function private.is_org_admin(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = p_org_id
      and om.user_id = auth.uid()
      and om.role in ('owner','admin')
  );
$$;

create or replace function private.is_org_owner(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_org_id and o.owner_id = auth.uid()
  );
$;

create or replace function private.is_org_unclaimed(p_org_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.organization_members om
    where om.organization_id = p_org_id
  );
$;

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.is_org_admin(uuid) from public;
revoke all on function private.is_org_owner(uuid) from public;
revoke all on function private.is_org_unclaimed(uuid) from public;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.is_org_owner(uuid) to authenticated;
grant execute on function private.is_org_unclaimed(uuid) to authenticated;

-- Members can read their orgs without recursive policy evaluation.
drop policy if exists "orgs read by members" on public.organizations;
create policy "orgs read by members"
  on public.organizations
  for select to authenticated using (private.is_org_member(id));
drop policy if exists "orgs insert by authenticated" on public.organizations;
create policy "orgs insert by authenticated"
  on public.organizations
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "org_members read by members" on public.organization_members;
create policy "org_members read by members"
  on public.organization_members
  for select to authenticated using (private.is_org_member(organization_id));
drop policy if exists "org_members insert by admins" on public.organization_members;
create policy "org_members insert by admins"
  on public.organization_members
  for insert to authenticated with check (
    (private.is_org_admin(organization_id) and role in ('member','viewer'))
    or (private.is_org_owner(organization_id) and role = 'admin')
    or (private.is_org_owner(organization_id) and role = 'owner'
        and private.is_org_unclaimed(organization_id))
  );

drop policy if exists "org_invites read by members" on public.organization_invites;
create policy "org_invites read by members"
  on public.organization_invites
  for select to authenticated using (
    private.is_org_member(organization_id)
    or lower(email) = lower((select email from public.users where id = auth.uid()))
  );
drop policy if exists "org_invites insert by admins" on public.organization_invites;
create policy "org_invites insert by admins"
  on public.organization_invites
  for insert to authenticated with check (
    private.is_org_admin(organization_id)
    and (role <> 'admin' or private.is_org_owner(organization_id))
  );

revoke all on public.organizations, public.organization_members, public.organization_invites from anon;
grant select, insert, update, delete on public.organizations to authenticated, service_role;
grant select, insert, update, delete on public.organization_members to authenticated, service_role;
grant select, insert, update, delete on public.organization_invites to authenticated, service_role;
