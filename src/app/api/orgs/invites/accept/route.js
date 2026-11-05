import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function client(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
}

export async function POST(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = client(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const inviteToken = typeof body?.token === "string" ? body.token : "";
  if (!inviteToken || inviteToken.length < 32 || inviteToken.length > 256) {
    return NextResponse.json({ error: "A valid invite token is required." }, { status: 400 });
  }
  if (!authData.user.email || !authData.user.email_confirmed_at) {
    return NextResponse.json({ error: "Your account must have a verified email address." }, { status: 403 });
  }

  const { data: organizationId, error } = await supabase.rpc("accept_organization_invite", {
    p_token: inviteToken,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("invite_not_found")) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    if (message.includes("invite_already_accepted")) return NextResponse.json({ error: "Invite already accepted." }, { status: 409 });
    if (message.includes("invite_expired")) return NextResponse.json({ error: "Invite expired." }, { status: 410 });
    if (message.includes("invite_email_mismatch")) return NextResponse.json({ error: "This invitation was issued to a different email address." }, { status: 403 });
    if (message.includes("verified_email_required") || message.includes("authentication_required")) {
      return NextResponse.json({ error: "A verified authenticated account is required." }, { status: 403 });
    }
    console.error("Organization invitation acceptance failed:", error.code || "unknown");
    return NextResponse.json({ error: "Could not accept invitation." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, organizationId });
}
