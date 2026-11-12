import { NextResponse } from "next/server";
import { consumeRateLimit } from "../../../../lib/rateLimit";
import { verifyN8nWebhookRequest } from "../../../../lib/n8nWebhookAuth";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  const verification = await verifyN8nWebhookRequest(request);
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: verification.status });
  }

  let limit;
  try {
    limit = await consumeRateLimit("n8n-events", { limit: 60, windowSeconds: 60 });
  } catch {
    return NextResponse.json({ error: "Rate-limit protection is temporarily unavailable." }, { status: 503 });
  }
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((Date.parse(limit.resetAt) - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { payload } = verification;
  if (typeof payload.event !== "string" || !payload.event.trim() || payload.event.length > 128) {
    return NextResponse.json({ error: "event must be a non-empty string of at most 128 characters." }, { status: 400 });
  }

  const idempotencyKey = payload.idempotencyKey == null ? null : payload.idempotencyKey;
  if (idempotencyKey !== null && (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.length > 128)) {
    return NextResponse.json({ error: "idempotencyKey must be a non-empty string of at most 128 characters." }, { status: 400 });
  }
  const eventPayload = payload.payload == null ? {} : payload.payload;
  if (!eventPayload || typeof eventPayload !== "object" || Array.isArray(eventPayload)) {
    return NextResponse.json({ error: "payload must be a JSON object." }, { status: 400 });
  }

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Event storage is temporarily unavailable." }, { status: 503 }); }

  const { data, error } = await admin.from("workflow_events").insert({
    event: payload.event.trim(),
    idempotency_key: idempotencyKey,
    payload: eventPayload,
  }).select("id,received_at").single();

  if (error?.code === "23505" && idempotencyKey) {
    return NextResponse.json(
      { ok: true, received: true, duplicate: true, event: payload.event.trim(), idempotencyKey },
      { status: 200 }
    );
  }
  if (error || !data) {
    return NextResponse.json({ error: "Could not persist automation event." }, { status: 503 });
  }

  return NextResponse.json(
    { ok: true, received: true, duplicate: false, event: payload.event.trim(), idempotencyKey, eventId: data.id, receivedAt: data.received_at },
    { status: 202 }
  );
}
