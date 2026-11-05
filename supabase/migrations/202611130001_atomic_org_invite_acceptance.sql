-- Accept an organization invitation and create membership atomically.
-- The row lock serializes concurrent acceptance attempts for the same invite.
create or replace function public.accept_organization_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_email_confirmed_at timestamptz;
  v_invite_id uuid;
  v_organization_id uuid;
  v_invite_email text;
  v_expires_at timestamptz;
  v_accepted_at timestamptz;
  v_role text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  if p_token is null or length(p_token) < 32 or length(p_token) > 256 then
    raise exception using errcode = '22023', message = 'invalid_invite_token';
  end if;

  select lower(btrim(u.email)), u.email_confirmed_at
    into v_user_email, v_email_confirmed_at
    from auth.users u
    where u.id = v_user_id;

  if v_user_email is null or v_email_confirmed_at is null then
    raise exception using errcode = '42501', message = 'verified_email_required';
  end if;

  select i.id, i.organization_id, lower(btrim(i.email)), i.expires_at, i.accepted_at, i.role
    into v_invite_id, v_organization_id, v_invite_email, v_expires_at, v_accepted_at, v_role
    from public.organization_invites i
    where i.token = p_token
    for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'invite_not_found';
  end if;
  if v_accepted_at is not null then
    raise exception using errcode = '23505', message = 'invite_already_accepted';
  end if;
  if v_expires_at <= now() then
    raise exception using errcode = '22023', message = 'invite_expired';
  end if;
  if v_invite_email is distinct from v_user_email then
    raise exception using errcode = '42501', message = 'invite_email_mismatch';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
    values (v_organization_id, v_user_id, v_role)
    on conflict (organization_id, user_id) do nothing;

  update public.organization_invites
    set accepted_at = now()
    where id = v_invite_id and accepted_at is null;

  return v_organization_id;
end;
$$;

revoke all on function public.accept_organization_invite(text) from public, anon;
grant execute on function public.accept_organization_invite(text) to authenticated;
