import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { hashToken } from "../../../../../../lib/oauth/session";
import { issueSessionToken, sessionCookieHeader } from "../../../../../../lib/oauth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const challengeCookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("wb_webauthn_challenge="));
  if (!challengeCookie) return NextResponse.json({ error: "missing_challenge" }, { status: 400 });

  let expectedChallenge: string;
  try { expectedChallenge = decodeURIComponent(challengeCookie.slice("wb_webauthn_challenge=".length)); }
  catch { return NextResponse.json({ error: "invalid_challenge" }, { status: 400 }); }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof body?.id !== "string" || body.id.length > 2048) {
    return NextResponse.json({ error: "invalid_credential" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: cred, error: credentialError } = await supabase.from("webauthn_credentials")
    .select("credential_id,user_id,public_key,counter,transports")
    .eq("credential_id", body.id).maybeSingle();
  if (credentialError || !cred) return NextResponse.json({ error: "credential_not_found" }, { status: 404 });

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
  } catch {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }
  if (!verification.verified) return NextResponse.json({ error: "verification_failed" }, { status: 401 });

  const { data: consumed, error: consumeError } = await supabase.from("webauthn_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("challenge_hash", hashToken(expectedChallenge))
    .eq("purpose", "authentication")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .or(`user_id.is.null,user_id.eq.${cred.user_id}`)
    .select("id")
    .maybeSingle();
  if (consumeError || !consumed) return NextResponse.json({ error: "challenge_expired_or_replayed" }, { status: 409 });

  const newCounter = verification.authenticationInfo.newCounter;
  const oldCounter = Number(cred.counter);
  if (newCounter > oldCounter) {
    const { data: updated, error: counterError } = await supabase.from("webauthn_credentials")
      .update({ counter: newCounter })
      .eq("credential_id", cred.credential_id)
      .eq("counter", oldCounter)
      .select("credential_id")
      .maybeSingle();
    if (counterError || !updated) return NextResponse.json({ error: "credential_counter_conflict" }, { status: 409 });
  }

  const { data: user, error: userError } = await supabase.from("users")
    .select("id,email").eq("id", cred.user_id).maybeSingle();
  if (userError || !user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const token = issueSessionToken(user.id, user.email);
  const response = NextResponse.json({ ok: true, verified: true });
  response.headers.set("Set-Cookie", sessionCookieHeader(token));
  response.cookies.set("wb_webauthn_challenge", "", { path: "/", maxAge: 0 });
  return response;
}
