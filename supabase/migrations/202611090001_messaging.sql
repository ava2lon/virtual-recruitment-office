create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.users(id) on delete set null,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- SECURITY DEFINER predicates live in a non-exposed schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.user_id = auth.uid()
  );
$$;

create or replace function private.can_add_conversation_participant(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.created_by = auth.uid()
  );
$$;

revoke all on function private.is_conversation_participant(uuid) from public;
revoke all on function private.can_add_conversation_participant(uuid) from public;
grant execute on function private.is_conversation_participant(uuid) to authenticated;
grant execute on function private.can_add_conversation_participant(uuid) to authenticated;

-- Participants can read their conversations.
drop policy if exists "conversations read by participants" on public.conversations;
create policy "conversations read by participants"
  on public.conversations
  for select to authenticated using (private.is_conversation_participant(id));
drop policy if exists "conversations insert by authenticated" on public.conversations;
create policy "conversations insert by authenticated"
  on public.conversations
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "conversations update by participants" on public.conversations;
create policy "conversations update by participants"
  on public.conversations
  for update to authenticated
  using (private.is_conversation_participant(id))
  with check (private.is_conversation_participant(id));

drop policy if exists "participants read own" on public.conversation_participants;
create policy "participants read own"
  on public.conversation_participants
  for select to authenticated using (
    user_id = auth.uid() or private.is_conversation_participant(conversation_id)
  );
drop policy if exists "participants insert by authenticated" on public.conversation_participants;
create policy "participants insert by authenticated"
  on public.conversation_participants
  for insert to authenticated with check (
    private.can_add_conversation_participant(conversation_id)
  );
drop policy if exists "participants update own read state" on public.conversation_participants;
create policy "participants update own read state"
  on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "messages read by participants" on public.messages;
create policy "messages read by participants"
  on public.messages
  for select to authenticated using (
    private.is_conversation_participant(messages.conversation_id)
  );
drop policy if exists "messages insert by participants" on public.messages;
create policy "messages insert by participants"
  on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and private.is_conversation_participant(conversation_id)
  );

revoke all on public.conversations, public.conversation_participants, public.messages from public, anon, authenticated;
grant select, insert on public.conversations to authenticated, service_role;
grant update (updated_at) on public.conversations to authenticated;
grant select, insert on public.conversation_participants to authenticated, service_role;
grant update (last_read_at) on public.conversation_participants to authenticated;
grant select, insert, update on public.messages to authenticated, service_role;
