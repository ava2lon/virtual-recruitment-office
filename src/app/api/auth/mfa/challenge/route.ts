import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSessionFromRequest } from "../../../../../lib/oauth/session";
import { verifyTotp } from "../../../../../lib/totp";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { userId?: string; code?: string; recoveryCode?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const userId = session.sub;
  const { code, recoveryCode } = body;

  const supabase = getSupabaseAdmin();
  const { data: mfa } = await supabase.from("user_mfa").select("*").eq("user_id", userId).maybeSingle();
  if (!mfa || !mfa.enabled) return NextResponse.json({ error: "mfa_not_enabled" }, { status: 404 });

  // Recovery code path.
  if (recoveryCode) {
    const hashed = crypto.createHash("sha256").update(recoveryCode.trim().toUpperCase()).digest("hex");
    const codes = (mfa.recovery_codes as string[]) || [];
    if (!codes.includes(hashed)) return NextResponse.json({ error: "invalid_recovery_code" }, { status: 401 });
    const remaining = codes.filter((c) => c !== hashed);
    await supabase.from("user_mfa").update({ recovery_codes: remaining, updated_at: new Date().toISOString() }).eq("user_id", userId);
    return NextResponse.json({ ok: true, verified: true, method: "recovery" });
  }

  if (!code || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const valid = verifyTotp(mfa.totp_secret, code);
  if (!valid) return NextResponse.json({ error: "invalid_code" }, { status: 401 });

  return NextResponse.json({ ok: true, verified: true, method: "totp" });
}
