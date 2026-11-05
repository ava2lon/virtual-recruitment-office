import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verifyTotp } from "../../../../../lib/totp";
import { getSessionFromRequest } from "../../../../../lib/oauth/session";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const userId = session.sub;

  let body: { code?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const code = body.code || "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "invalid_code_format" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: mfa } = await supabase.from("user_mfa").select("*").eq("user_id", userId).maybeSingle();
  if (!mfa) return NextResponse.json({ error: "mfa_not_enrolled" }, { status: 404 });

  const valid = verifyTotp(mfa.totp_secret, code);
  if (!valid) return NextResponse.json({ error: "invalid_code" }, { status: 401 });

  // Generate recovery codes.
  const recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString("hex").toUpperCase());
  const hashed = recoveryCodes.map((c) => crypto.createHash("sha256").update(c).digest("hex"));

  await supabase.from("user_mfa").update({
    enabled: true,
    recovery_codes: hashed,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return NextResponse.json({ ok: true, recoveryCodes });
}
