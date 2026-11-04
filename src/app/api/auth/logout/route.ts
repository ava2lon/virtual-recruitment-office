import { NextResponse } from "next/server";
import { clearSessionCookieHeader } from "../../../../lib/oauth/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  response.headers.set("Set-Cookie", clearSessionCookieHeader());
  return response;
}
