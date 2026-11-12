create index if not exists conversations_updated_id_idx
  on public.conversations (updated_at desc, id desc);

create or replace function public.list_user_conversations(
  p_user_id uuid,
  p_limit integer,
  p_before_updated_at timestamptz,
  p_before_id uuid
)
returns table (
  conversation_id uuid,
  subject text,
  updated_at timestamptz,
  last_read_at timestamptz,
  last_message_id uuid,
  last_message_body text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_user_id is null
     or p_limit is null or p_limit < 1 or p_limit > 100
     or ((p_before_updated_at is null) <> (p_before_id is null)) then
    raise exception 'Invalid conversation pagination parameters' using errcode = '22023';
  end if;

  return query
    select
      c.id,
      c.subject,
      c.updated_at,
      cp.last_read_at,
      latest.id,
      latest.body,
      latest.created_at,
      latest.sender_id
    from public.conversation_participants cp
    join public.conversations c on c.id = cp.conversation_id
    left join lateral (
      select m.id, m.body, m.created_at, m.sender_id
      from public.messages m
      where m.conversation_id = c.id
      order by m.created_at desc, m.id desc
      limit 1
    ) latest on true
    where cp.user_id = p_user_id
      and (
        p_before_updated_at is null
        or (c.updated_at, c.id) < (p_before_updated_at, p_before_id)
      )
    order by c.updated_at desc, c.id desc
    limit p_limit + 1;
end;
$$;

revoke all on function public.list_user_conversations(uuid, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.list_user_conversations(uuid, integer, timestamptz, uuid)
  to service_role;