import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/oauth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.redirect(new URL("/login?error=authentication_required", origin));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/settings?error=google_not_configured", origin));
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: origin + "/api/calendar/google/callback",
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  const response = NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString());
  response.cookies.set("wb_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/calendar/google/callback",
    maxAge: 600,
  });
  return response;
}
