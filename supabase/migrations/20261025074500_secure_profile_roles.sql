-- Prevent users from promoting their own profile to recruiter/admin or changing roles after signup.
-- Initial signup may choose candidate/employer only; recruiter/admin roles must be granted by an administrator.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_role public.app_role;
  v_full_name text;
begin
  v_role := case
    when new.raw_user_meta_data->>'role' in ('candidate', 'employer')
      then (new.raw_user_meta_data->>'role')::public.app_role
    else 'candidate'::public.app_role
  end;
  v_full_name := nullif(trim(new.raw_user_meta_data->>'full_name'), '');

  insert into public.profiles (id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), case when v_full_name is not null then split_part(v_full_name, ' ', 1) else null end),
    coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), case when v_full_name is not null and position(' ' in v_full_name) > 0 then nullif(trim(substr(v_full_name, position(' ' in v_full_name) + 1)), '') else null end),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security invoker
set search_path = 'public'
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator may change account roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
before update of role on public.profiles
for each row execute function public.prevent_profile_role_escalation();
