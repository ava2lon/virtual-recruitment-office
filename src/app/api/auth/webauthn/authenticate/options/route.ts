import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = body?.email;

  const supabase = getSupabaseAdmin();
  let allowCredentials: { id: string; transports?: string[] }[] = [];

  if (email) {
    const { data: user } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (user) {
      const { data: creds } = await supabase.from("webauthn_credentials").select("credential_id, transports").eq("user_id", user.id);
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

  const response = NextResponse.json(options);
  response.cookies.set("wb_webauthn_challenge", options.challenge, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 300,
  });
  return response;
}
