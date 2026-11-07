-- Indexes supporting participant lookups and bounded chronological message pagination.
create index if not exists idx_messages_conversation_created_id
  on public.messages (conversation_id, created_at, id);

create index if not exists idx_conversation_participants_user_conversation
  on public.conversation_participants (user_id, conversation_id);
