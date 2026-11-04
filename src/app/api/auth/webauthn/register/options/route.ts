import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSupabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/wb_session=([^;]+)/);
  const token = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let userId: string; let email: string;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    userId = payload.sub; email = payload.email;
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("webauthn_credentials").select("credential_id, transports").eq("user_id", userId);

  const origin = new URL(request.url).origin;
  const rpID = new URL(origin).hostname;

  const options = await generateRegistrationOptions({
    rpName: "WorkBridge",
    rpID,
    userID: Buffer.from(userId),
    userName: email,
    userDisplayName: email,
    attestationType: "none",
    excludeCredentials: (existing || []).map((c) => ({
      id: c.credential_id,
      transports: c.transports || [],
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  const response = NextResponse.json(options);
  response.cookies.set("wb_webauthn_challenge", options.challenge, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 300,
  });
  return response;
}
