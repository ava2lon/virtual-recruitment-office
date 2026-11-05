import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const migrationFiles = {
  hardened: "../supabase/migrations/20261025100000_harden_security_definer_search_path.sql",
  tenantScope: "../supabase/migrations/20261025110000_scope_interview_scheduling_to_company.sql",
  interviewPrivacy: "../supabase/migrations/20261025120000_limit_employer_interview_response_fields.sql",
};
const migrations = Object.fromEntries(
  Object.entries(migrationFiles).map(([key, path]) => [
    key,
    readFileSync(new URL(path, import.meta.url), "utf8"),
  ]),
);

function functionBody(sourceName, functionName) {
  const source = migrations[sourceName];
  assert.ok(source, "Missing migration source: " + sourceName);
  const start = source.indexOf("create or replace function public." + functionName + "(");
  assert.notEqual(start, -1, "Missing function definition: " + functionName + " in " + sourceName);
  const next = source.indexOf("\ncreate or replace function public.", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

const checks = [
  {
    source: "hardened",
    name: "employer_create_company",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/auth\.uid\(\)\s+is\s+null/i, "must reject anonymous callers"],
      [/role\s*=\s*'employer'/i, "must require the employer role"],
      [/insert into public\.company_members/i, "must create owner membership for the company"],
    ],
  },
  {
    source: "hardened",
    name: "employer_create_job",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/auth\.uid\(\)\s+is\s+null/i, "must reject anonymous callers"],
      [/company_id\s*=\s*p_company_id[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i, "must scope job creation to the caller's company membership"],
    ],
  },
  {
    source: "interviewPrivacy",
    name: "get_employer_interviews",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/v_role\s*<>\s*'employer'/i, "must require the employer role"],
      [/public\.is_company_member\(j\.company_id\)/i, "must scope interview results to company membership"],
      [/'application'[\s\S]*?'job'[\s\S]*?'candidate'/i, "must construct explicit nested response objects"],
      [/'first_name'[\s\S]*?'last_name'[\s\S]*?'location'[\s\S]*?'years_experience'/i, "must return approved candidate summary fields"],
    ],
    forbidden: [
      [/to_jsonb\(i\)|to_jsonb\(a\)|to_jsonb\(j\)/i, "must not serialize complete interview, application, or job rows"],
      [/'recruiter_notes'/i, "must not expose recruiter notes"],
      [/'ai_screening'/i, "must not expose AI screening payloads"],
      [/'match_score'/i, "must not expose matching scores"],
      [/'screening_score'/i, "must not expose screening scores"],
      [/'recruiter_score'/i, "must not expose recruiter scores"],
    ],
  },
  {
    source: "tenantScope",
    name: "recruiter_schedule_interview",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/v_role\s+not\s+in\s*\('recruiter',\s*'admin'\)/i, "must restrict scheduling to recruiter/admin roles"],
      [/application_not_found/i, "must validate that the application exists"],
      [/join public\.company_members cm on cm\.company_id = j\.company_id/i, "must resolve company membership through the application's job"],
      [/cm\.user_id = v_user/i, "must require the caller to belong to that company"],
      [/if v_role <> 'admin' and not exists/i, "must restrict cross-company scheduling for non-admins"],
      [/insert into public\.interviews/i, "must create the interview only after authorization checks"],
      [/update public\.applications[\s\S]*?where id = p_application_id/i, "must update the application linked to the authorized interview"],
      [/insert into public\.audit_logs/i, "must audit interview scheduling"],
      [/jsonb_build_object\([\s\S]*?'application_id'[\s\S]*?'scheduled_at'/i, "must record the application and schedule in audit metadata"],
    ],
  },
];

let count = 0;
for (const check of checks) {
  const body = functionBody(check.source, check.name);
  for (const [pattern, message] of check.assertions) {
    assert.match(body, pattern, check.name + " " + message);
    count += 1;
  }
  for (const [pattern, message] of check.forbidden || []) {
    assert.doesNotMatch(body, pattern, check.name + " " + message);
    count += 1;
  }
  console.log("PASS " + check.name);
}

const sessionSource = readFileSync(new URL("../src/lib/oauth/session.ts", import.meta.url), "utf8");
assert.match(sessionSource, /timingSafeEqual/, "session signatures must use constant-time comparison");
assert.match(sessionSource, /byteLength\(secret, "utf8"\) < 32/, "session secrets must be at least 32 bytes");
assert.match(sessionSource, /decoded\.exp <= now/, "expired sessions must be rejected");
assert.match(sessionSource, /header\?\.alg !== "HS256"/, "session algorithm must be pinned to HS256");
assert.doesNotMatch(sessionSource, /dev-session-secret-change-me/, "must not contain a predictable fallback session secret");
count += 5;

const calendarEventsSource = readFileSync(new URL("../src/app/api/calendar/events/route.ts", import.meta.url), "utf8");
assert.match(calendarEventsSource, /getSessionFromRequest\(request\)/, "calendar event creation must verify the session signature");
assert.doesNotMatch(calendarEventsSource, /Buffer\.from\(sessionToken\.split/, "calendar event creation must not decode unverified session claims");
count += 2;

const calendarCallbackSource = readFileSync(new URL("../src/app/api/calendar/google/callback/route.ts", import.meta.url), "utf8");
assert.match(calendarCallbackSource, /timingSafeEqual/, "Google Calendar callback must compare OAuth state safely");
assert.match(calendarCallbackSource, /getSessionFromRequest\(request\)/, "Google Calendar callback must require a verified user session");
count += 2;

const mfaChallengeSource = readFileSync(new URL("../src/app/api/auth/mfa/challenge/route.ts", import.meta.url), "utf8");
assert.match(mfaChallengeSource, /getSessionFromRequest\(request\)/, "MFA challenges must be bound to the authenticated user");
assert.doesNotMatch(mfaChallengeSource, /const \{ userId, code, recoveryCode \}/, "MFA challenge must not trust a caller-supplied user ID");
count += 2;


const oauthCallbackSource = readFileSync(new URL("../src/app/api/auth/callback/[provider]/route.ts", import.meta.url), "utf8");
assert.match(oauthCallbackSource, /wb_oauth_state/, "OAuth callback must bind state to the initiating browser cookie");
assert.match(oauthCallbackSource, /timingSafeEqual/, "OAuth state comparison must be constant-time");
count += 2;

const inviteSource = readFileSync(new URL("../src/app/api/orgs/[id]/invite/route.js", import.meta.url), "utf8");
assert.match(inviteSource, /organization_members/, "organization invites must verify caller membership");
assert.match(inviteSource, /membership\.role !== "owner"/, "only owners may grant admin role");
assert.match(inviteSource, /crypto\.randomBytes\(32\)/, "invite tokens must have 256 bits of entropy");
count += 3;

const acceptInviteSource = readFileSync(new URL("../src/app/api/orgs/invites/accept/route.js", import.meta.url), "utf8");
assert.match(acceptInviteSource, /getSessionFromRequest\(request\)/, "invite acceptance must verify the signed application session");
assert.match(acceptInviteSource, /accept_organization_invite/, "invite acceptance must use the atomic database RPC");
assert.match(acceptInviteSource, /getSupabaseAdmin\(\)/, "atomic invitation RPC must be invoked only from the server admin client");
assert.doesNotMatch(acceptInviteSource, /auth\.getUser\(/, "custom application sessions must not be sent to Supabase Auth");
assert.doesNotMatch(acceptInviteSource, /from\("organization_members"\)/, "route must not create membership outside the transaction");
const atomicInviteMigration = readFileSync(new URL("../supabase/migrations/202611130001_atomic_org_invite_acceptance.sql", import.meta.url), "utf8");
assert.match(atomicInviteMigration, /security definer/i, "atomic invite RPC must be SECURITY DEFINER");
assert.match(atomicInviteMigration, /set search_path\s*=\s*''/i, "atomic invite RPC must pin an empty search_path");
assert.match(atomicInviteMigration, /p_user_id uuid/, "atomic invite RPC must require a server-verified user ID");
assert.match(atomicInviteMigration, /where u\.id = p_user_id/, "atomic invite RPC must resolve the user by ID");
assert.match(atomicInviteMigration, /public\.users/, "atomic invite RPC must use the custom OAuth user table");
assert.match(atomicInviteMigration, /email_verified is distinct from true/, "atomic invite RPC must require a verified custom OAuth email");
assert.doesNotMatch(atomicInviteMigration, /auth\.users/, "custom OAuth accounts must not depend on Supabase Auth users");
assert.match(atomicInviteMigration, /for update/i, "atomic invite RPC must lock the invitation row");
assert.match(atomicInviteMigration, /on conflict \(organization_id, user_id\) do nothing/i, "atomic invite RPC must safely handle existing membership");
assert.match(atomicInviteMigration, /revoke all on function public\.accept_organization_invite\(text, uuid\) from public, anon, authenticated/i, "atomic invite RPC must not be exposed to public or authenticated clients");
assert.match(atomicInviteMigration, /grant execute on function public\.accept_organization_invite\(text, uuid\) to service_role/i, "atomic invite RPC must be callable only by the server service role");
const inviteCreateSource = readFileSync(new URL("../src/app/api/orgs/[id]/invite/route.js", import.meta.url), "utf8");
assert.match(inviteCreateSource, /getSessionFromRequest\(request\)/, "invite creation must verify the signed application session");
assert.match(inviteCreateSource, /membership\.role !== "owner"/, "only owners may grant the admin role");
const orgRouteSource = readFileSync(new URL("../src/app/api/orgs/route.js", import.meta.url), "utf8");
assert.match(orgRouteSource, /getSessionFromRequest\(request\)/, "organization APIs must verify the signed application session");
assert.match(orgRouteSource, /crypto\.randomBytes/, "organization slugs must use cryptographic randomness");
const conversationsSource = readFileSync(new URL("../src/app/api/messages/conversations/route.js", import.meta.url), "utf8");
assert.match(conversationsSource, /getSessionFromRequest\(request\)/, "messaging APIs must verify the signed application session");
assert.match(conversationsSource, /created_by: session\.sub/, "new conversations must be bound to their creator");
assert.match(conversationsSource, /participantIds\.length > 49/, "conversation creation must cap participant count");
const messagesSource = readFileSync(new URL("../src/app/api/messages/[conversationId]/route.js", import.meta.url), "utf8");
assert.match(messagesSource, /getSessionFromRequest\(request\)/, "message reads and sends must verify the signed application session");
assert.match(messagesSource, /getParticipant\(admin, conversationId, session\.sub\)/, "message access must require conversation membership");
const messagingMigration = readFileSync(new URL("../supabase/migrations/202611090001_messaging.sql", import.meta.url), "utf8");
assert.match(messagingMigration, /private\.is_conversation_participant/, "message RLS must use the private membership helper");
assert.match(messagingMigration, /private\.can_add_conversation_participant/, "participant insertion must be limited to conversation creators");
assert.doesNotMatch(messagingMigration, /create policy if not exists/i, "messaging migration must use PostgreSQL-compatible policy DDL");
const orgMigration = readFileSync(new URL("../supabase/migrations/202611110001_multi_tenant_orgs.sql", import.meta.url), "utf8");
assert.match(orgMigration, /private\.is_org_admin/, "organization role changes must use private admin checks");
assert.match(orgMigration, /private\.is_org_unclaimed/, "first organization membership must be owner-only");
assert.doesNotMatch(orgMigration, /create policy if not exists/i, "organization migration must use PostgreSQL-compatible policy DDL");
const calendarMigration = readFileSync(new URL("../supabase/migrations/202611130002_calendar_connections.sql", import.meta.url), "utf8");
assert.match(calendarMigration, /revoke all on public\.user_calendar_connections from public, anon, authenticated/i, "OAuth tokens must not be readable through the client Data API");
assert.match(calendarMigration, /grant all on public\.user_calendar_connections to service_role/i, "OAuth token storage must be server-only");
const webauthnMigration = readFileSync(new URL("../supabase/migrations/202611140001_webauthn_one_time_challenges.sql", import.meta.url), "utf8");
assert.match(webauthnMigration, /challenge_hash text not null unique/i, "WebAuthn challenges must be stored by unique hash");
assert.match(webauthnMigration, /consumed_at timestamptz/i, "WebAuthn challenges must track one-time consumption");
assert.match(webauthnMigration, /revoke all on public\.webauthn_challenges from public, anon, authenticated/i, "WebAuthn challenge storage must be server-only");
const registerOptionsSource = readFileSync(new URL("../src/app/api/auth/webauthn/register/options/route.ts", import.meta.url), "utf8");
const registerVerifySource = readFileSync(new URL("../src/app/api/auth/webauthn/register/verify/route.ts", import.meta.url), "utf8");
const authOptionsSource = readFileSync(new URL("../src/app/api/auth/webauthn/authenticate/options/route.ts", import.meta.url), "utf8");
const authVerifySource = readFileSync(new URL("../src/app/api/auth/webauthn/authenticate/verify/route.ts", import.meta.url), "utf8");
for (const [source, label] of [[registerOptionsSource,"registration options"],[registerVerifySource,"registration verification"]]) {
  assert.match(source, /getSessionFromRequest\(request\)/, `WebAuthn ${label} must verify the signed application session`);
}
for (const [source, label] of [[registerOptionsSource,"registration options"],[registerVerifySource,"registration verification"],[authOptionsSource,"authentication options"],[authVerifySource,"authentication verification"]]) {
  assert.match(source, /webauthn_challenges/, `WebAuthn ${label} must use persisted one-time challenges`);
  assert.match(source, /hashToken\(/, `WebAuthn ${label} must persist only a challenge hash`);
}
assert.match(registerVerifySource, /\.is\("consumed_at", null\)/, "registration challenge must be consumed once");
assert.match(authVerifySource, /\.is\("consumed_at", null\)/, "authentication challenge must be consumed once");
assert.match(authVerifySource, /credential_counter_conflict/, "authenticator counters must use optimistic concurrency control");
const samlSource = readFileSync(new URL("../src/lib/saml.ts", import.meta.url), "utf8");
const samlLoginSource = readFileSync(new URL("../src/app/api/auth/saml/login/route.ts", import.meta.url), "utf8");
const samlAcsSource = readFileSync(new URL("../src/app/api/auth/saml/acs/route.ts", import.meta.url), "utf8");
const samlCacheMigration = readFileSync(new URL("../supabase/migrations/202611150001_saml_request_cache.sql", import.meta.url), "utf8");
assert.match(samlSource, /validateInResponseTo:\s*ValidateInResponseTo\.always/, "SAML responses must correlate to an SP-initiated request");
assert.match(samlSource, /consumeAsync\(/, "SAML request IDs must be consumed atomically to prevent replay");
assert.match(samlLoginSource, /getAuthorizeFormAsync\(relayState\)/, "SAML login must use the library-generated AuthnRequest");
assert.match(samlSource, /saml_request_cache/, "SAML request correlation must use shared server-side storage");
assert.match(samlCacheMigration, /revoke all on public\.saml_request_cache from public, anon, authenticated/i, "SAML request cache must be server-only");
assert.doesNotMatch(orgMigration, /as \$(?:\r?\n)|\r?\n\$;/i, "organization migration must use valid SQL dollar delimiters");
assert.match(samlLoginSource, /wb_saml_state/, "SAML login must bind RelayState to the initiating browser");
assert.match(samlAcsSource, /safeEqual\(stateCookie, relayState\)/, "SAML ACS must timing-safely validate browser-bound RelayState");
assert.match(samlAcsSource, /validatePostResponseAsync/, "SAML ACS must use the library's signed-response validation");
assert.match(samlAcsSource, /profile\.issuer !== config\.idpEntityId/, "SAML ACS must verify the trusted identity provider issuer");
assert.doesNotMatch(samlAcsSource, /encodeURIComponent\(msg\)/, "SAML validation errors must not be reflected to login URLs");
count += 24;

const refreshSource = readFileSync(new URL("../src/app/api/auth/refresh/route.ts", import.meta.url), "utf8");
assert.match(refreshSource, /insertError/, "refresh rotation must check token persistence errors");
assert.match(refreshSource, /revokeError/, "refresh rotation must check revocation errors");
count += 2;

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationNames = readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql"));
const migrationVersions = migrationNames.map((name) => name.split("_")[0]);
assert.equal(new Set(migrationVersions).size, migrationVersions.length, "migration version prefixes must be unique");
count += 1;
for (const name of migrationNames) {
  const sql = readFileSync(new URL(name, migrationDirectory), "utf8");
  assert.doesNotMatch(sql, /create\s+policy\s+if\s+not\s+exists/i, name + " must use PostgreSQL-compatible policy DDL");
  count += 1;
}
for (const name of [
  "202611090001_messaging.sql",
  "202611110001_multi_tenant_orgs.sql",
  "202611120001_org_scoped_isolation.sql",
  "202611130001_atomic_org_invite_acceptance.sql",
]) {
  const sql = readFileSync(new URL(name, migrationDirectory), "utf8");
  const delimiters = sql.match(/\$\$/g) || [];
  assert.equal(delimiters.length % 2, 0, name + " must have balanced SQL function delimiters");
  count += 1;
}

console.log("Security regression checks passed: " + count);
