import { NextResponse } from "next/server";
import { verifySessionToken, issueSessionToken, sessionCookieHeader, issueRefreshToken, hashToken, refreshCookieHeader, clearRefreshCookieHeader } from "../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const refreshMatch = cookieHeader.match(/wb_refresh=([^;]+)/);
  const refreshToken = refreshMatch ? decodeURIComponent(refreshMatch[1]) : null;
  if (!refreshToken) {
    return NextResponse.json({ error: "missing_refresh_token" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const tokenHash = hashToken(refreshToken);

  const { data: session, error } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("refresh_token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !session) {
    const response = NextResponse.json({ error: "invalid_refresh_token" }, { status: 401 });
    response.headers.set("Set-Cookie", clearRefreshCookieHeader());
    return response;
  }

  if (new Date(session.expires_at) < new Date()) {
    await supabase.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
    const response = NextResponse.json({ error: "refresh_token_expired" }, { status: 401 });
    response.headers.set("Set-Cookie", clearRefreshCookieHeader());
    return response;
  }

  // Rotate: revoke old, issue new.
  await supabase.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);

  const { data: user } = await supabase.from("users").select("id,email").eq("id", session.user_id).maybeSingle();
  if (!user) {
    const response = NextResponse.json({ error: "user_not_found" }, { status: 401 });
    response.headers.set("Set-Cookie", clearRefreshCookieHeader());
    return response;
  }

  const newAccessToken = issueSessionToken(user.id, user.email);
  const newRefreshToken = issueRefreshToken();
  await supabase.from("user_sessions").insert({
    user_id: user.id,
    refresh_token_hash: hashToken(newRefreshToken),
    user_agent: request.headers.get("user-agent") || null,
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", sessionCookieHeader(newAccessToken));
  response.headers.append("Set-Cookie", refreshCookieHeader(newRefreshToken));
  return response;
}
