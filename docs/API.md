# WorkBridge API

## Health and version
- `GET /api/health` → `{ status, service, timestamp }`
- `GET /api/version` → service version, deployment commit, environment, timestamp.

## Vacancy published (outbound trigger)
- `POST /api/vacancy-published`
- Headers: `Authorization: Bearer <Supabase access token>`, `Content-Type: application/json`
- Body: `{ "jobId": "<uuid>", "companyId": "<uuid>" }`
- Request body limit: 16 KiB.
- Triggers `WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL` using the dedicated `x-workbridge-secret` header.
- Requires a valid authenticated employer/company membership. Preview read-only deployments reject this action.

## Signed inbound automation events
- `POST /api/n8n/events`
- Headers:
  - `Content-Type: application/json`
  - `x-workbridge-timestamp: <10-digit Unix seconds>`
  - `x-workbridge-nonce: <22-128 base64url characters>`
  - `x-workbridge-signature: v1=<64 hexadecimal characters>`
- HMAC input: `<timestamp>.<nonce>.<exact-raw-request-body>`
- Body:
  ```json
  {
    "event": "candidate.application.received",
    "idempotencyKey": "caller-generated-key",
    "payload": { "applicationId": "..." }
  }
  ```
- `event` is required (1-128 characters); `idempotencyKey` is optional (1-128 characters); `payload` must be a JSON object.
- Request body limit: 256 KiB; timestamp tolerance: ±5 minutes.
- Accepted events are persisted in the server-only `workflow_events` table. A repeated `(event, idempotencyKey)` returns HTTP 200 with `duplicate: true`; a new event returns HTTP 202 with `eventId`.
- Shared rate limit: 60 authenticated requests per minute across all application instances for this endpoint. HTTP 429 includes `Retry-After`; unavailable rate-limit storage fails closed with HTTP 503.

## Dead-letter persistence
- `POST /api/n8n/dead-letter`
- Uses the same HMAC headers, signature input, nonce protection, clock tolerance, and 256 KiB body limit as the inbound event endpoint.
- Body:
  ```json
  {
    "event": "candidate.application.received",
    "idempotencyKey": "caller-generated-key",
    "payload": { "applicationId": "..." },
    "error": "Downstream delivery failed"
  }
  ```
- `event` is required (1-128 characters); `idempotencyKey` is optional (1-128 characters); `payload` must be a JSON object; `error` is optional (maximum 4000 characters).
- Failures are persisted in the server-only `workflow_dead_letters` table. Duplicate keys return HTTP 200 with `duplicate: true`; new records return HTTP 202 with `deadLetterId` and initial status `open`.
- Shared rate limit: 60 authenticated requests per minute across all application instances for this endpoint. HTTP 429 includes `Retry-After`; unavailable rate-limit storage fails closed with HTTP 503.

## Messaging
- `GET /api/messages/conversations` — list conversations for the authenticated user.
- `POST /api/messages/conversations` — create a conversation. JSON request body limit: 16 KiB.
- `GET /api/messages/:conversationId?limit=50` — read the newest message page. For older messages, pass both `beforeCreatedAt=<ISO-8601 timestamp>` and `beforeId=<message UUID>` from `pagination.nextCursor`. Messages are returned in chronological order, `limit` is 1-100, and `pagination.hasMore` indicates older pages.
- `POST /api/messages/:conversationId` — send a message. JSON request body limit: 16 KiB; message text limit: 10,000 characters.
- All message operations require a valid application session and conversation membership.

## Organization operations
- `POST /api/orgs` — create an organization. JSON request body limit: 16 KiB.
- `POST /api/orgs/:id/invite` — invite an organization member. JSON request body limit: 16 KiB. Owner/admin authorization applies; only owners may grant the admin role.

## Conventions
- Timestamps are ISO-8601 UTC.
- Idempotency keys are caller-generated opaque strings; use the same key when retrying the same logical event.
- Webhook nonces must be unique per request and must never be reused on retry.
- Secrets are never returned in responses.
