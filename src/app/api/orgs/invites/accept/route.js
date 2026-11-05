import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const inviteToken = typeof body?.token === "string" ? body.token : "";
  if (!inviteToken || inviteToken.length < 32 || inviteToken.length > 256) {
    return NextResponse.json({ error: "A valid invite token is required." }, { status: 400 });
  }

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Invitation service is not configured." }, { status: 503 }); }

  const { data: organizationId, error } = await admin.rpc("accept_organization_invite", {
    p_token: inviteToken,
    p_user_id: session.sub,
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
