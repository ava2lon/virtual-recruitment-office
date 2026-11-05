import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getSessionFromRequest, hashToken } from "../../../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

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
  } catch {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: consumed, error: consumeError } = await supabase.from("webauthn_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("challenge_hash", hashToken(expectedChallenge))
    .eq("user_id", session.sub)
    .eq("purpose", "registration")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (consumeError || !consumed) return NextResponse.json({ error: "challenge_expired_or_replayed" }, { status: 409 });

  const { credential } = verification.registrationInfo;
  const { error: insertError } = await supabase.from("webauthn_credentials").insert({
    user_id: session.sub,
    credential_id: credential.id,
    public_key: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: body.response?.transports || [],
  });
  if (insertError) return NextResponse.json({ error: "credential_save_failed" }, { status: 409 });

  const response = NextResponse.json({ ok: true, verified: true });
  response.cookies.set("wb_webauthn_challenge", "", { path: "/", maxAge: 0 });
  return response;
}
