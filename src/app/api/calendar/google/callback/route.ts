import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/lib/oauth/session";

export const runtime = "nodejs";

function clearStateCookie(response: NextResponse) {
  response.cookies.set("wb_google_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/calendar/google/callback",
    maxAge: 0,
  });
  return response;
}

function fail(origin: string, code: string) {
  return clearStateCookie(NextResponse.redirect(new URL("/settings?error=" + encodeURIComponent(code), origin)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const session = getSessionFromRequest(request);
  if (!session) return clearStateCookie(NextResponse.redirect(new URL("/login?error=authentication_required", origin)));

  const state = url.searchParams.get("state") || "";
  const cookieHeader = request.headers.get("cookie") || "";
  const stateCookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith("wb_google_oauth_state="));
  let expectedState = "";
  try { expectedState = stateCookie ? decodeURIComponent(stateCookie.slice("wb_google_oauth_state=".length)) : ""; }
  catch { return fail(origin, "invalid_oauth_state"); }
  const supplied = Buffer.from(state);
  const expected = Buffer.from(expectedState);
  if (!state || !expectedState || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return fail(origin, "invalid_oauth_state");
  }

  const code = url.searchParams.get("code");
  if (!code) return fail(origin, "missing_code");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(origin, "google_not_configured");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: origin + "/api/calendar/google/callback",
      grant_type: "authorization_code",
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenRes.ok) return fail(origin, "token_exchange_failed");
  const tokens = await tokenRes.json();
  if (typeof tokens.access_token !== "string" || !tokens.access_token) return fail(origin, "invalid_token_response");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return fail(origin, "supabase_not_configured");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing, error: lookupError } = await supabase
    .from("user_calendar_connections")
    .select("refresh_token")
    .eq("user_id", session.sub)
    .eq("provider", "google")
    .maybeSingle();
  if (lookupError) return fail(origin, "calendar_lookup_failed");

  const expiresAt = typeof tokens.expires_in === "number"
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;
  const { error: saveError } = await supabase.from("user_calendar_connections").upsert({
    user_id: session.sub,
    provider: "google",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || existing?.refresh_token || null,
    expires_at: expiresAt,
    scope: typeof tokens.scope === "string" ? tokens.scope : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });
  if (saveError) return fail(origin, "calendar_connection_save_failed");

  return clearStateCookie(NextResponse.redirect(new URL("/settings?calendar=connected", origin)));
}
