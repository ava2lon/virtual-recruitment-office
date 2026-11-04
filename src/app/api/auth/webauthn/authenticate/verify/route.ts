import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { issueSessionToken, sessionCookieHeader } from "../../../../../../lib/oauth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const challengeMatch = cookieHeader.match(/wb_webauthn_challenge=([^;]+)/);
  const expectedChallenge = challengeMatch ? decodeURIComponent(challengeMatch[1]) : null;
  if (!expectedChallenge) return NextResponse.json({ error: "missing_challenge" }, { status: 400 });

  const body = await request.json();
  const supabase = getSupabaseAdmin();

  const { data: cred } = await supabase
    .from("webauthn_credentials")
    .select("*")
    .eq("credential_id", body.id)
    .maybeSingle();
  if (!cred) return NextResponse.json({ error: "credential_not_found" }, { status: 404 });

  const origin = new URL(request.url).origin;
  const rpID = new URL(origin).hostname;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey: Buffer.from(cred.public_key, "base64url"),
        counter: Number(cred.counter),
        transports: cred.transports || [],
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "verification_failed" }, { status: 400 });
  }

  if (!verification.verified) return NextResponse.json({ error: "verification_failed" }, { status: 401 });

  await supabase
    .from("webauthn_credentials")
    .update({ counter: verification.authenticationInfo.newCounter })
    .eq("credential_id", cred.credential_id);

  const { data: user } = await supabase.from("users").select("id,email").eq("id", cred.user_id).maybeSingle();
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const token = issueSessionToken(user.id, user.email);
  const response = NextResponse.json({ ok: true, verified: true });
  response.headers.set("Set-Cookie", sessionCookieHeader(token));
  response.cookies.set("wb_webauthn_challenge", "", { path: "/", maxAge: 0 });
  return response;
}
