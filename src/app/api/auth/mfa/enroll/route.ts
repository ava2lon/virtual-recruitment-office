import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSessionFromRequest } from "../../../../../lib/oauth/session";
import { generateSecret, buildOtpAuthUri } from "../../../../../lib/totp";
import QRCode from "qrcode";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const userId = session.sub;

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from("users").select("id,email").eq("id", userId).maybeSingle();
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const secret = generateSecret();
  const otpauthUri = buildOtpAuthUri(secret, user.email);

  // Upsert pending (not enabled).
  await supabase.from("user_mfa").upsert({
    user_id: user.id,
    totp_secret: secret,
    enabled: false,
    recovery_codes: [],
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  const qrDataUrl = await QRCode.toDataURL(otpauthUri);
  return NextResponse.json({ secret, otpauthUri, qrDataUrl });
}
