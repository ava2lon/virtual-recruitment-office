import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionMatch = cookieHeader.match(/wb_session=([^;]+)/);
  const token = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let userId: string;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    userId = payload.sub;
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  await supabase.from("user_mfa").delete().eq("user_id", userId);
  return NextResponse.json({ ok: true, disabled: true });
}
