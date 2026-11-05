import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings?error=missing_code", origin));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.redirect(new URL("/settings?error=google_not_configured", origin));

  // Exchange code for tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${origin}/api/calendar/google/callback`,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) return NextResponse.redirect(new URL("/settings?error=token_exchange_failed", origin));
  const tokens = await tokenRes.json();

  // Get user id from wb_session cookie.
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/wb_session=([^;]+)/);
  const sessionToken = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
  if (!sessionToken) return NextResponse.redirect(new URL("/login", origin));

  let userId: string;
  try {
    const payload = JSON.parse(Buffer.from(sessionToken.split(".")[1], "base64url").toString("utf8"));
    userId = payload.sub;
  } catch {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.redirect(new URL("/settings?error=supabase_not_configured", origin));

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

  await supabase.from("user_calendar_connections").upsert({
    user_id: userId,
    provider: "google",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expires_at: expiresAt,
    scope: tokens.scope || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });

  return NextResponse.redirect(new URL("/settings?calendar=connected", origin));
}
