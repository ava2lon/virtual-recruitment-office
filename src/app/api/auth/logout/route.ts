import { NextResponse } from "next/server";
import { clearSessionCookieHeader, clearRefreshCookieHeader, hashToken, REFRESH_COOKIE } from "../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const refreshMatch = cookieHeader.match(new RegExp("(?:^|;\\\\s*)" + REFRESH_COOKIE + "=([^;]+)"));
  if (refreshMatch) {
    try {
      const refreshToken = decodeURIComponent(refreshMatch[1]);
      if (refreshToken) {
        const supabase = getSupabaseAdmin();
        await supabase.from("user_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("refresh_token_hash", hashToken(refreshToken))
          .is("revoked_at", null);
      }
    } catch {
      // Always clear browser cookies even if session revocation storage is unavailable.
    }
  }

  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin), { status: 303 });
  response.headers.append("Set-Cookie", clearSessionCookieHeader());
  response.headers.append("Set-Cookie", clearRefreshCookieHeader());
  return response;
}
