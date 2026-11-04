import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verifyTotp } from "../../../../../lib/totp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { userId?: string; code?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { userId, code } = body;
  if (!userId || !code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: mfa } = await supabase.from("user_mfa").select("*").eq("user_id", userId).maybeSingle();
  if (!mfa || !mfa.enabled) {
    return NextResponse.json({ error: "mfa_not_enabled" }, { status: 404 });
  }

  const valid = verifyTotp(mfa.totp_secret, code);
  if (!valid) return NextResponse.json({ error: "invalid_code" }, { status: 401 });

  return NextResponse.json({ ok: true, verified: true });
}
