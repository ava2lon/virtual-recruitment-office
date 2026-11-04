import { NextResponse } from "next/server";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../../../../../lib/oauth/pkce";
import { signState } from "../../../../../lib/oauth/state";
import { buildAuthorizationUrl } from "../../../../../lib/oauth/providers";
import type { OAuthProvider } from "../../../../../types/oauth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as OAuthProvider;
  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const rawState = generateState();
    const statePayload = JSON.stringify({ state: rawState, codeVerifier, provider });
    const signedState = signState(Buffer.from(statePayload).toString("base64url"));

    const redirectUri = `${new URL(request.url).origin}/api/auth/callback/${provider}`;
    const url = buildAuthorizationUrl(provider, redirectUri, signedState, codeChallenge);

    const response = NextResponse.redirect(url);
    // Store code verifier in HTTP-only cookie for callback retrieval.
    response.cookies.set("wb_oauth_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    response.cookies.set("wb_oauth_state", signedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_init_failed";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
