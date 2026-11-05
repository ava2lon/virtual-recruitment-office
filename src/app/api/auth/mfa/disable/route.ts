import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSessionFromRequest } from "../../../../../lib/oauth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const userId = session.sub;

  const supabase = getSupabaseAdmin();
  await supabase.from("user_mfa").delete().eq("user_id", userId);
  return NextResponse.json({ ok: true, disabled: true });
}
