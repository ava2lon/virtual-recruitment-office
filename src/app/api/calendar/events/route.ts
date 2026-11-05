import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/wb_session=([^;]+)/);
  const sessionToken = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
  if (!sessionToken) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let userId: string;
  try {
    const payload = JSON.parse(Buffer.from(sessionToken.split(".")[1], "base64url").toString("utf8"));
    userId = payload.sub;
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: conn } = await supabase.from("user_calendar_connections").select("*").eq("user_id", userId).eq("provider", "google").maybeSingle();
  if (!conn) return NextResponse.json({ error: "calendar_not_connected" }, { status: 404 });

  let body: { summary?: string; description?: string; start?: string; end?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const event = {
    summary: body.summary || "WorkBridge event",
    description: body.description || "",
    start: { dateTime: body.start, timeZone: "UTC" },
    end: { dateTime: body.end, timeZone: "UTC" },
  };

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "calendar_api_failed", detail: err }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json({ ok: true, eventId: data.id, htmlLink: data.htmlLink });
}
