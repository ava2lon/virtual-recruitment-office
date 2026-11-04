# WorkBridge API (n8n integration)

## Health
- `GET /api/health` → `{ status, service, timestamp }`

## Vacancy published (outbound trigger)
- `POST /api/vacancy-published`
- Headers: `Authorization: Bearer <supabase access token>`
- Body: `{ jobId: string, companyId: string }`
- Triggers the configured `WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL` workflow.

## Inbound automation events
- `POST /api/n8n/events`
- Headers: `x-workbridge-secret: <WORKBRIDGE_N8N_INBOUND_SECRET>`
- Body: `{ event: string, idempotencyKey?: string, payload?: object }`
- Returns `202 { ok, received, event, idempotencyKey }`.

## Conventions
- All timestamps ISO-8601 UTC.
- Idempotency keys are caller-generated UUIDs; retries must reuse the same key.
- Secrets are never returned in responses.
