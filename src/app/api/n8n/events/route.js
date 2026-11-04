import { NextResponse } from "next/server";
import { rateLimit, clientKey } from "../../../../lib/rateLimit";

export const runtime = "nodejs";

function limited(request) {
  const result = rateLimit("n8n-events:" + clientKey(request), { limit: 60, windowMs: 60_000 });
  if (!result.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  return null;
}

export async function POST(request) {
  const limitedResponse = limited(request);
  if (limitedResponse) return limitedResponse;
  const secret = process.env.WORKBRIDGE_N8N_INBOUND_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Inbound automation is not configured." }, { status: 503 });
  }

  const provided = request.headers.get("x-workbridge-secret") || "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Invalid automation secret." }, { status: 401 });
  }

  let payload;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "A valid JSON payload is required." }, { status: 400 }); }

  if (!payload || typeof payload.event !== "string") {
    return NextResponse.json({ error: "event is required." }, { status: 400 });
  }

  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : null;

  // Acknowledge receipt. Downstream processing is handled by the platform
  // (Supabase RLS + n8n). This endpoint provides a stable contract for
  // workflow callbacks and idempotency tracking.
  return NextResponse.json(
    { ok: true, received: true, event: payload.event, idempotencyKey },
    { status: 202 }
  );
}
