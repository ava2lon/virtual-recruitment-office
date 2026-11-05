import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/lib/oauth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  let body: { summary?: string; description?: string; start?: string; end?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const summary = typeof body.summary === "string" ? body.summary.trim() : "WorkBridge event";
  const description = typeof body.description === "string" ? body.description : "";
  const start = typeof body.start === "string" ? body.start : "";
  const end = typeof body.end === "string" ? body.end : "";
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!summary || summary.length > 200 || description.length > 5000 ||
      !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return NextResponse.json({ error: "invalid_event_payload" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: conn, error: connectionError } = await supabase
    .from("user_calendar_connections")
    .select("access_token")
    .eq("user_id", session.sub)
    .eq("provider", "google")
    .maybeSingle();
  if (connectionError) return NextResponse.json({ error: "calendar_lookup_failed" }, { status: 500 });
  if (!conn?.access_token) return NextResponse.json({ error: "calendar_not_connected" }, { status: 404 });

  const event = {
    summary,
    description,
    start: { dateTime: new Date(startTime).toISOString(), timeZone: "UTC" },
    end: { dateTime: new Date(endTime).toISOString(), timeZone: "UTC" },
  };

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 401) return NextResponse.json({ error: "google_token_expired_reconnect_required" }, { status: 409 });
  if (!res.ok) return NextResponse.json({ error: "calendar_api_failed" }, { status: 502 });
  const data = await res.json();
  return NextResponse.json({ ok: true, eventId: data.id, htmlLink: data.htmlLink });
}
