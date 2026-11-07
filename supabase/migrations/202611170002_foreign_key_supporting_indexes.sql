-- Cover foreign-key lookups identified by the Supabase performance advisor.
create index if not exists idx_conversations_created_by on public.conversations (created_by);
create index if not exists idx_messages_sender_id on public.messages (sender_id);
create index if not exists idx_organization_invites_invited_by on public.organization_invites (invited_by);
create index if not exists idx_organization_invites_organization_id on public.organization_invites (organization_id);
create index if not exists idx_organization_members_user_id on public.organization_members (user_id);
create index if not exists idx_organizations_owner_id on public.organizations (owner_id);
create index if not exists idx_user_identities_user_id on public.user_identities (user_id);
create index if not exists idx_user_roles_granted_by on public.user_roles (granted_by);
create index if not exists idx_user_roles_role_id on public.user_roles (role_id);
create index if not exists idx_webauthn_challenges_user_id on public.webauthn_challenges (user_id);
create index if not exists idx_webauthn_credentials_user_id on public.webauthn_credentials (user_id);
