import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { hashToken } from "../../../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const supabase = getSupabaseAdmin();
  let userId: string | null = null;
  let allowCredentials: { id: string; transports?: string[] }[] = [];

  if (email) {
    const { data: user, error: userError } = await supabase.from("users")
      .select("id").ilike("email", email).maybeSingle();
    if (userError) return NextResponse.json({ error: "could_not_load_account" }, { status: 500 });
    if (user) {
      userId = user.id;
      const { data: creds, error: credentialsError } = await supabase.from("webauthn_credentials")
        .select("credential_id,transports").eq("user_id", user.id);
      if (credentialsError) return NextResponse.json({ error: "could_not_load_credentials" }, { status: 500 });
      allowCredentials = (creds || []).map((c) => ({ id: c.credential_id, transports: c.transports || [] }));
    }
  }

  const origin = new URL(request.url).origin;
  const rpID = new URL(origin).hostname;
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: allowCredentials.length ? allowCredentials : undefined,
    userVerification: "preferred",
  });

  const { error: challengeError } = await supabase.from("webauthn_challenges").insert({
    challenge_hash: hashToken(options.challenge),
    user_id: userId,
    purpose: "authentication",
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
