create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
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

-- Participants can read their conversations.
create policy if not exists "conversations read by participants" on public.conversations
  for select to authenticated using (
    exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversations.id and cp.user_id = auth.uid())
  );
create policy if not exists "conversations insert by authenticated" on public.conversations
  for insert to authenticated with check (true);

create policy if not exists "participants read own" on public.conversation_participants
  for select to authenticated using (user_id = auth.uid() or exists (
    select 1 from public.conversation_participants cp2 where cp2.conversation_id = conversation_participants.conversation_id and cp2.user_id = auth.uid()
  ));
create policy if not exists "participants insert by authenticated" on public.conversation_participants
  for insert to authenticated with check (true);

create policy if not exists "messages read by participants" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid())
  );
create policy if not exists "messages insert by participants" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and exists (select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid())
  );

revoke all on public.conversations, public.conversation_participants, public.messages from anon;
grant select, insert, update on public.conversations to authenticated, service_role;
grant select, insert, update on public.conversation_participants to authenticated, service_role;
grant select, insert, update on public.messages to authenticated, service_role;
