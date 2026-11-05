import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSessionFromRequest, hashToken } from "../../../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: user, error: userError } = await supabase.from("users")
    .select("id,email").eq("id", session.sub).maybeSingle();
  if (userError || !user || user.email !== session.email) {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const { data: existing, error: credentialsError } = await supabase.from("webauthn_credentials")
    .select("credential_id,transports").eq("user_id", user.id);
  if (credentialsError) return NextResponse.json({ error: "could_not_load_credentials" }, { status: 500 });

  const origin = new URL(request.url).origin;
  const rpID = new URL(origin).hostname;
  const options = await generateRegistrationOptions({
    rpName: "WorkBridge",
    rpID,
    userID: Buffer.from(user.id),
    userName: user.email,
    userDisplayName: user.email,
    attestationType: "none",
    excludeCredentials: (existing || []).map((c) => ({ id: c.credential_id, transports: c.transports || [] })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  const { error: challengeError } = await supabase.from("webauthn_challenges").insert({
    challenge_hash: hashToken(options.challenge),
    user_id: user.id,
    purpose: "registration",
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  if (challengeError) return NextResponse.json({ error: "could_not_store_challenge" }, { status: 503 });

  const response = NextResponse.json(options);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set("wb_webauthn_challenge", options.challenge, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 300,
  });
  return response;
}
