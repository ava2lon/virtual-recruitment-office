import { NextResponse } from "next/server";
import { verifyState } from "../../../../../lib/oauth/state";
import { exchangeCodeForTokens, fetchProviderProfile } from "../../../../../lib/oauth/providers";
import { issueSessionToken, sessionCookieHeader, issueRefreshToken, hashToken, refreshCookieHeader } from "../../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import type { OAuthProvider, DbUser } from "../../../../../types/oauth";

export const runtime = "nodejs";

function fail(origin: string, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, origin));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as OAuthProvider;
  const url = new URL(request.url);
  const origin = url.origin;

  try {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) {
      return fail(origin, `provider_error:${errorParam}`);
    }
    if (!code || !stateParam) {
      return fail(origin, "missing_code_or_state");
    }

    // Validate state (CSRF protection).
    const decoded = verifyState(stateParam);
    if (!decoded) {
      return fail(origin, "state_mismatch");
    }
    let parsed: { state: string; codeVerifier: string; provider: OAuthProvider };
    try {
      parsed = JSON.parse(Buffer.from(decoded, "base64url").toString("utf8"));
    } catch {
      return fail(origin, "invalid_state_payload");
    }
    if (parsed.provider !== provider) {
      return fail(origin, "provider_mismatch");
    }

    // Retrieve code verifier from cookie.
    const cookieHeader = request.headers.get("cookie") || "";
    const verifierMatch = cookieHeader.match(/wb_oauth_verifier=([^;]+)/);
    const codeVerifier = verifierMatch ? decodeURIComponent(verifierMatch[1]) : parsed.codeVerifier;
    if (!codeVerifier) {
      return fail(origin, "missing_code_verifier");
    }

    const redirectUri = `${origin}/api/auth/callback/${provider}`;

    // Token exchange (server-side only).
    const tokens = await exchangeCodeForTokens(provider, code, redirectUri, codeVerifier);

    // Fetch provider profile.
    const profile = await fetchProviderProfile(provider, tokens);

    // Verify email.
    if (!profile.emailVerified) {
      return fail(origin, "UNVERIFIED_EMAIL");
    }

    const supabase = getSupabaseAdmin();

    // Check if user with email exists.
    const { data: existingUser, error: lookupError } = await supabase
      .from("users")
      .select("*")
      .eq("email", profile.email)
      .maybeSingle();

    if (lookupError) {
      return fail(origin, "db_lookup_failed");
    }

    let user: DbUser;
    let isNewUser = false;
    let linkedIdentity = false;

    if (!existingUser) {
      // Case 1: create new user + identity.
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          email: profile.email,
          name: profile.name,
          avatar_url: profile.avatarUrl,
          email_verified: true,
        })
        .select("*")
        .single();
      if (createError || !newUser) {
        return fail(origin, "user_creation_failed");
      }
      user = newUser as DbUser;
      isNewUser = true;

      const { error: identityError } = await supabase.from("user_identities").insert({
        user_id: user.id,
        provider,
        provider_user_id: profile.providerUserId,
      });
      if (identityError) {
        return fail(origin, "identity_link_failed");
      }
      linkedIdentity = true;
    } else {
      user = existingUser as DbUser;
      // Check if identity link exists.
      const { data: existingIdentity } = await supabase
        .from("user_identities")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .eq("provider_user_id", profile.providerUserId)
        .maybeSingle();

      if (!existingIdentity) {
        // Case 2: link identity + update missing profile fields.
        const { error: linkError } = await supabase.from("user_identities").insert({
          user_id: user.id,
          provider,
          provider_user_id: profile.providerUserId,
        });
        if (linkError) {
          return fail(origin, "identity_link_failed");
        }
        linkedIdentity = true;

        // Update profile fields if missing.
        const updates: Record<string, unknown> = {};
        if (!user.name && profile.name) updates.name = profile.name;
        if (!user.avatar_url && profile.avatarUrl) updates.avatar_url = profile.avatarUrl;
        if (!user.email_verified) updates.email_verified = true;
        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase.from("users").update(updates).eq("id", user.id);
        }
      }
      // Case 3: proceed.
    }

    // Issue session + refresh token (rotation-ready).
    const token = issueSessionToken(user.id, user.email);
    const refreshToken = issueRefreshToken();
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("user_sessions").insert({
        user_id: user.id,
        refresh_token_hash: hashToken(refreshToken),
        user_agent: request.headers.get("user-agent") || null,
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch {
      // Non-fatal: session still issued.
    }
    const response = NextResponse.redirect(new URL("/dashboard", origin));
    response.headers.append("Set-Cookie", sessionCookieHeader(token));
    response.headers.append("Set-Cookie", refreshCookieHeader(refreshToken));
    // Clear oauth cookies.
    response.cookies.set("wb_oauth_verifier", "", { path: "/", maxAge: 0 });
    response.cookies.set("wb_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_callback_failed";
    return fail(origin, message);
  }
}
