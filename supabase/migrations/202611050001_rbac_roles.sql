-- Role-based access control (RBAC) foundation.
create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.app_roles(id) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  unique (role_id, permission)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.app_roles(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  unique (user_id, role_id)
);

alter table public.app_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

-- Readable by authenticated users (needed for client permission checks).
create policy if not exists "app_roles readable by authenticated"
  on public.app_roles for select to authenticated using (true);
create policy if not exists "role_permissions readable by authenticated"
  on public.role_permissions for select to authenticated using (true);
create policy if not exists "user_roles readable by self"
  on public.user_roles for select to authenticated using (user_id = auth.uid());

-- Seed default roles.
insert into public.app_roles (name, description) values
  ('candidate', 'Job seeker'),
  ('employer', 'Hiring company member'),
  ('recruiter', 'Recruitment operator'),
  ('admin', 'Platform administrator')
on conflict (name) do nothing;

-- Helper: does the current user have a permission?
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = auth.uid()
      and rp.permission = p_permission
  );
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;
