# WorkBridge

WorkBridge is a recruitment platform connecting candidates and employers.

> One platform. Zero friction. One connection.

## Stack

- Next.js App Router
- React
- Supabase Auth and PostgreSQL database
- Vercel deployment
- n8n automation integration

## Features

- Candidate application tracker with private follow-up notes.
- Employer vacancy publishing with automated social-copy workflow.
- Hiring pipeline board grouped by stage.
- Candidate analytics dashboard.
- Dark/light theme with design tokens.
- Health, OG image, and inbound automation endpoints.
- Organization membership and invitations.
- OAuth sign-in, MFA, passkeys, SAML SSO, and Google Calendar integration.

## Requirements

- Node.js 20 or later (CI currently runs Node.js 24).
- npm.
- A Supabase project.
- A Vercel project for hosted deployments.
- n8n only if vacancy/social-copy or inbound workflow automation is enabled.

## Local development

1. Clone the repository and enter the project directory.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Create `.env.local` in the repository root and set the variables described in [Environment variables](#environment-variables).
4. Apply the SQL migrations in `supabase/migrations/` to the intended Supabase project. See [Supabase setup](#supabase-setup).
5. Start the development server:
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000.

Do not commit `.env.local`, production credentials, OAuth client secrets, service-role keys, SAML private material, or webhook secrets.

## Environment variables

Set variables in the environment where the application runs. For local development, use `.env.local`. For Vercel, configure them under **Project → Settings → Environment Variables** and select the appropriate Development, Preview, and Production targets. Redeploy after changing Vercel environment variables.

### Core Supabase and application settings

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL, e.g. `https://<project-ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes, unless publishable key is used | Supabase legacy anon/public key. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes, unless anon key is used | Supabase publishable key. Use either this or `NEXT_PUBLIC_SUPABASE_ANON_KEY`; the application prefers the anon key if both are present. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for server-side admin operations | Supabase service-role key used by trusted server routes for privileged database access. **Never prefix it with `NEXT_PUBLIC_`; never expose it to browsers.** |
| `SESSION_SECRET` | Required for custom signed sessions | Random secret of at least 32 bytes used to sign WorkBridge session tokens. |
| `AUTH_SECRET` | Alternative to `SESSION_SECRET` | Backward-compatible fallback for session signing. Set `SESSION_SECRET` in preference to this variable. |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical public origin, e.g. `https://your-domain.example`. Used to build published vacancy URLs. Defaults to `https://101.vercel.app` when omitted. |
| `NEXT_PUBLIC_WORKBRIDGE_PREVIEW_READONLY` | Optional | Set to the literal string `true` on preview deployments that share production data to disable vacancy-published automation. Leave unset or set to `false` only where publishing automation is intentionally enabled. |

Generate a session secret locally with:

```bash
openssl rand -hex 32
```

### OAuth sign-in and Google Calendar

Google credentials are used by Google OAuth sign-in and Google Calendar connection. Register the redirect URLs below in the corresponding Google Cloud OAuth client. Add your actual local and production origins; do not register wildcard redirect URLs.

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Required for Google sign-in and Google Calendar | Google OAuth 2.0 client ID. |
| `GOOGLE_CLIENT_SECRET` | Required for Google sign-in and Google Calendar | Google OAuth 2.0 client secret. |
| `FACEBOOK_CLIENT_ID` | Required only if Facebook sign-in is enabled | Facebook Login app ID. |
| `FACEBOOK_CLIENT_SECRET` | Required only if Facebook sign-in is enabled | Facebook Login app secret. |

Configure these authorized redirect URIs for each environment:

- Google sign-in: `https://<your-origin>/api/auth/callback/google`
- Facebook sign-in: `https://<your-origin>/api/auth/callback/facebook`
- Google Calendar: `https://<your-origin>/api/calendar/google/callback`

For local development, replace `https://<your-origin>` with `http://localhost:3000`. Google Calendar requires the Google OAuth client to have the appropriate Calendar API enabled and the consent screen/scopes configured. Use the same Google client ID and secret for both Google sign-in and Calendar unless your deployment intentionally separates those OAuth clients.

### SAML single sign-on (optional)

Set these values only when configuring an identity provider (IdP) for SAML SSO. The service provider (SP) metadata endpoint is `/api/auth/saml/metadata`; the assertion consumer service (ACS) endpoint is `/api/auth/saml/acs`.

| Variable | Required for SAML | Description |
|---|---|---|
| `SAML_SP_ENTITY_ID` | Optional | WorkBridge SP entity ID. Defaults to `<base-url>/api/auth/saml/metadata`. Configure the same identifier in the IdP. |
| `SAML_IDP_ENTITY_ID` | Yes | Exact issuer/entity ID supplied by the IdP. |
| `SAML_IDP_SSO_URL` | Yes | IdP Single Sign-On (SSO) URL using HTTPS. |
| `SAML_IDP_CERT` | Yes | IdP signing certificate in PEM or the certificate format accepted by Node-SAML. Store the certificate as a Vercel environment variable; do not commit private keys or secrets. |

Configure the IdP with the WorkBridge metadata from `https://<your-origin>/api/auth/saml/metadata`, and set its ACS/Reply URL to `https://<your-origin>/api/auth/saml/acs`. Use the exact entity ID and certificate provided by your IdP. The SAML request cache is stored in Supabase and must be migrated before enabling SAML.

### n8n automation and webhook security

| Variable | Required | Description |
|---|---|---|
| `WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL` | Optional; required to send published-vacancy events to n8n | Full HTTPS production webhook URL for the n8n **WorkBridge — Published Vacancy Social Drafts** workflow. If omitted, the vacancy is published without queueing social-copy automation. |
| `WORKBRIDGE_N8N_INBOUND_SECRET` | Required when n8n callbacks or vacancy webhook integration are enabled | Shared secret with at least 32 UTF-8 bytes. Use a high-entropy random value and configure the same value on the sending and receiving sides. |

Generate a shared secret with:

```bash
openssl rand -hex 32
```

**Published-vacancy webhook:** the `/api/vacancy-published` application route sends the `x-workbridge-secret` header with `WORKBRIDGE_N8N_INBOUND_SECRET` to the configured n8n webhook URL. Create a dedicated n8n credential with these exact settings:

| Setting | Value |
|---|---|
| Credential type | `Header Auth` (`httpHeaderAuth`) |
| Credential name | `WorkBridge Vacancy Webhook Auth` |
| Header name | `x-workbridge-secret` |
| Header value | The exact value of `WORKBRIDGE_N8N_INBOUND_SECRET` in the matching Vercel environment |

In n8n, open **Credentials → Add credential → Header Auth**, enter the settings above, and save. Then open the **Published Vacancy Webhook** node in **WorkBridge — Published Vacancy Social Drafts**, set **Authentication** to **Header Auth**, and select `WorkBridge Vacancy Webhook Auth`. Set the webhook method to `POST`, save the workflow, and copy its Production URL into `WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL` in Vercel.

Generate the secret locally with `openssl rand -hex 32`; paste it directly into the n8n credential and Vercel's encrypted environment-variable settings. Do not send it in chat, commit it, or put it in the webhook URL, query string, workflow payload, Slack messages, or execution logs. Use separate secrets and endpoints for staging and production. Keep the workflow inactive until the credential is attached and an authenticated test succeeds; then activate it. An unauthenticated request should be rejected.

**Signed application callbacks:** the application routes `/api/n8n/events` and `/api/n8n/dead-letter` verify HMAC-SHA256 signatures using `WORKBRIDGE_N8N_INBOUND_SECRET`. Send the exact raw JSON body and these headers:

- `content-type: application/json`
- `x-workbridge-timestamp`: Unix timestamp in seconds (10 digits).
- `x-workbridge-nonce`: unique random value for every request (22–128 URL-safe characters).
- `x-workbridge-signature`: `v1=<lowercase-hex-hmac>`.

The HMAC input is the UTF-8 byte sequence:

```text
<timestamp>.<nonce>.<exact-raw-request-body>
```

The signature is:

```text
hex(HMAC-SHA256(WORKBRIDGE_N8N_INBOUND_SECRET, signing-input))
```

Requests must be within five minutes of server time, have a JSON object body, and be no larger than 256 KiB. A nonce can only be accepted once; nonce hashes are stored in the server-only `n8n_webhook_nonces` Supabase table. The sender must generate a new nonce and signature for every retry. Do not reuse a signature after a timeout.

### CI and test-only configuration

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Only for `npm run test:authorization` | PostgreSQL connection string. GitHub Actions creates an isolated PostgreSQL service and injects this value automatically. For local authorization integration tests, point it at a disposable test database, never production. |
| `NODE_ENV` | Managed by Next.js/Vercel | Runtime mode. Next.js and Vercel set this automatically; do not normally define it manually in Vercel. |

### Local `.env.local` template

Copy this template and fill only the credentials for features you intend to enable. Leave optional values unset if you are not using that integration.

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Or use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY instead:
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# WorkBridge session signing (generate a unique value with: openssl rand -hex 32)
SESSION_SECRET=

# Canonical app URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Set true only for preview deployments that must not trigger vacancy automation
NEXT_PUBLIC_WORKBRIDGE_PREVIEW_READONLY=false

# Google OAuth and Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional Facebook OAuth
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=

# Optional SAML SSO
SAML_SP_ENTITY_ID=
SAML_IDP_ENTITY_ID=
SAML_IDP_SSO_URL=
SAML_IDP_CERT=

# Optional n8n integration
WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL=
WORKBRIDGE_N8N_INBOUND_SECRET=

# Only needed for local authorization integration tests; use a disposable database
DATABASE_URL=
```

Do not copy the template's blank values into production as-is. Set real secrets through the hosting provider's encrypted environment-variable settings. Never expose `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, OAuth client secrets, or `WORKBRIDGE_N8N_INBOUND_SECRET` in client-side code.

## Supabase setup

1. Create or select the Supabase project.
2. Copy the project URL, anon/legacy key or publishable key, and service-role key from the Supabase project settings.
3. Set the core Supabase environment variables listed above in local development and Vercel.
4. Apply the migrations in `supabase/migrations/` in filename order using the Supabase CLI or your controlled migration process. For a new CLI-linked environment:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
5. Confirm the migrations are recorded and required tables exist. Sensitive tables such as session, MFA, WebAuthn, SAML cache, workflow failure/dead-letter, and webhook nonce records must remain protected by RLS and server-only grants.
6. Do not use the service-role key in browser code. Server routes that require elevated database access must use server-only modules.

For production, run migrations against the intended project only after reviewing the migration diff and taking an appropriate database backup.

## Vercel deployment configuration

1. Import `ava2lon/virtual-recruitment-office` into Vercel and select the correct project.
2. Set the Root Directory to the repository root and use the Next.js framework preset.
3. Add the required core variables to **Production** and **Preview** as appropriate.
4. Add OAuth and SAML values only to environments where those integrations are configured.
5. Set `NEXT_PUBLIC_WORKBRIDGE_PREVIEW_READONLY=true` for previews that share production data and must not trigger live vacancy automation.
6. Set `WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL` and `WORKBRIDGE_N8N_INBOUND_SECRET` only in environments authorized to call the live n8n workflow. Use separate secrets and webhook endpoints for staging and production.
7. Deploy or redeploy after changing environment variables. A variable change does not retroactively update an already-built deployment.
8. Verify the deployed health endpoint at `/api/health` and test sign-in, database access, and the enabled integrations.

Use Vercel's Production, Preview, and Development scopes deliberately. Do not copy production secrets into Preview unless the preview is intentionally authorized to access the same systems.

## n8n workflow configuration

For the published vacancy workflow:

1. Generate a fresh 32-byte random secret locally with `openssl rand -hex 32`.
2. In n8n, open **Credentials → Add credential → Header Auth**.
3. Save a dedicated credential named `WorkBridge Vacancy Webhook Auth`, with header name `x-workbridge-secret` and the generated secret as its header value.
4. Open **WorkBridge — Published Vacancy Social Drafts** and edit the **Published Vacancy Webhook** trigger node.
5. Set **Authentication** to **Header Auth** and select `WorkBridge Vacancy Webhook Auth`.
6. In Vercel, set `WORKBRIDGE_N8N_INBOUND_SECRET` to the exact same secret and `WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL` to the trigger's HTTPS Production URL. Apply each variable only to the intended environment; use distinct values for staging and production.
7. Save the workflow and run an authenticated synthetic test. Confirm an unauthenticated request is rejected. Activate the workflow only after both checks pass.
8. Ensure the Slack destination and AI model credentials are configured in n8n. Those credentials are managed inside n8n and are not application environment variables.

The `/api/n8n/events` and `/api/n8n/dead-letter` endpoints are separate signed callback endpoints. Their senders must implement the HMAC header contract above; Header Auth alone is not a substitute for that signature contract.

## Scripts

- `npm run dev` — development server.
- `npm run build` — production build.
- `npm run start` — start the production server.
- `npm run lint` — lint.
- `npm run test:security` — security regression checks.
- `npm run test:authorization` — isolated PostgreSQL authorization integration tests (requires `DATABASE_URL`).
- `npm run storybook` — start Storybook.
- `npm run build-storybook` — build Storybook.

## API

See [docs/API.md](docs/API.md).

## Security

See [SECURITY.md](SECURITY.md). Never commit secrets; use encrypted environment-variable storage. Rotate any credential that has been accidentally committed, logged, or shared.
