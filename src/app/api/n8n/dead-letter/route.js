import { NextResponse } from "next/server";
import { rateLimit, clientKey } from "../../../../lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request) {
  const result = rateLimit("n8n-deadletter:" + clientKey(request), { limit: 60, windowMs: 60_000 });
  if (!result.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const secret = process.env.WORKBRIDGE_N8N_INBOUND_SECRET;
  if (!secret) return NextResponse.json({ error: "Inbound automation is not configured." }, { status: 503 });
  const provided = request.headers.get("x-workbridge-secret") || "";
  if (provided !== secret) return NextResponse.json({ error: "Invalid automation secret." }, { status: 401 });

  let payload;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "A valid JSON payload is required." }, { status: 400 }); }

  if (!payload || typeof payload.event !== "string") {
    return NextResponse.json({ error: "event is required." }, { status: 400 });
  }

  // Acknowledge. Persistence is handled by the connected Supabase project via
  // service-role writes; this endpoint provides a stable contract for n8n.
  return NextResponse.json(
    { ok: true, recorded: true, event: payload.event, receivedAt: new Date().toISOString() },
    { status: 202 }
  );
}
