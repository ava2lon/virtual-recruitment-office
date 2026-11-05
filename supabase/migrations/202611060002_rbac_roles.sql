-- Server-managed role-based access control (RBAC) foundation.
-- Application sessions are custom signed sessions, so role data is accessed
-- only through authenticated server routes using the service-role client.
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
  user_id uuid not null references public.users(id) on delete cascade,
  role_id uuid not null references public.app_roles(id) on delete cascade,
  granted_by uuid references public.users(id),
  granted_at timestamptz not null default now(),
  unique (user_id, role_id)
);

alter table public.app_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

revoke all on public.app_roles, public.role_permissions, public.user_roles from public, anon, authenticated;
grant all on public.app_roles, public.role_permissions, public.user_roles to service_role;

insert into public.app_roles (name, description) values
  ('candidate', 'Job seeker'),
  ('employer', 'Hiring company member'),
  ('recruiter', 'Recruitment operator'),
  ('admin', 'Platform administrator')
on conflict (name) do nothing;
