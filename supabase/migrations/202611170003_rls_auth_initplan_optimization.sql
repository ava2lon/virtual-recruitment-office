-- Wrap stable auth.uid() lookups in scalar subqueries so PostgreSQL can
-- evaluate them once per statement instead of once per candidate row.
drop policy if exists "users read own" on public.users;
create policy "users read own" on public.users
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "user_identities read own" on public.user_identities;
create policy "user_identities read own" on public.user_identities
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "orgs insert by authenticated" on public.organizations;
create policy "orgs insert by authenticated" on public.organizations
  for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "org_invites read by members" on public.organization_invites;
create policy "org_invites read by members" on public.organization_invites
  for select to authenticated using (
    private.is_org_member(organization_id)
    or lower(email) = lower((select email from public.users where id = (select auth.uid())))
  );

drop policy if exists "conversations insert by authenticated" on public.conversations;
create policy "conversations insert by authenticated" on public.conversations
  for insert to authenticated with check (created_by = (select auth.uid()));

drop policy if exists "participants read own" on public.conversation_participants;
create policy "participants read own" on public.conversation_participants
  for select to authenticated using (
    user_id = (select auth.uid()) or private.is_conversation_participant(conversation_id)
  );

drop policy if exists "participants update own read state" on public.conversation_participants;
create policy "participants update own read state" on public.conversation_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "messages insert by participants" on public.messages;
create policy "messages insert by participants" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid()) and private.is_conversation_participant(conversation_id)
  );
