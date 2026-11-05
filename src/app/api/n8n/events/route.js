import { NextResponse } from "next/server";
import { rateLimit, clientKey } from "../../../../lib/rateLimit";
import { verifyN8nWebhookRequest } from "../../../../lib/n8nWebhookAuth";

export const runtime = "nodejs";

export async function POST(request) {
  const limit = rateLimit("n8n-events:" + clientKey(request), { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const verification = await verifyN8nWebhookRequest(request);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }

  const { payload } = verification;
  if (typeof payload.event !== "string" || !payload.event.trim() || payload.event.length > 128) {
    return NextResponse.json({ error: "event must be a non-empty string of at most 128 characters." }, { status: 400 });
  }

  const idempotencyKey = payload.idempotencyKey == null ? null : payload.idempotencyKey;
  if (idempotencyKey !== null && (typeof idempotencyKey !== "string" || idempotencyKey.length > 128)) {
    return NextResponse.json({ error: "idempotencyKey must be a string of at most 128 characters." }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, received: true, event: payload.event, idempotencyKey },
    { status: 202 }
  );
}
