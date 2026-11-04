import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/wb_session=([^;]+)/);
  const token = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let userId: string;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    userId = payload.sub;
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const challengeMatch = cookieHeader.match(/wb_webauthn_challenge=([^;]+)/);
  const expectedChallenge = challengeMatch ? decodeURIComponent(challengeMatch[1]) : null;
  if (!expectedChallenge) return NextResponse.json({ error: "missing_challenge" }, { status: 400 });

  const body = await request.json();
  const origin = new URL(request.url).origin;
  const rpID = new URL(origin).hostname;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "verification_failed" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const supabase = getSupabaseAdmin();
  await supabase.from("webauthn_credentials").insert({
    user_id: userId,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: body.response?.transports || [],
  });

  const response = NextResponse.json({ ok: true, verified: true });
  response.cookies.set("wb_webauthn_challenge", "", { path: "/", maxAge: 0 });
  return response;
}
