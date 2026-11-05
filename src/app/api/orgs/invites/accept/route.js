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

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const inviteToken = typeof body?.token === "string" ? body.token : "";
  if (!inviteToken || inviteToken.length > 256) return NextResponse.json({ error: "A valid invite token is required." }, { status: 400 });
  const authenticatedEmail = typeof authData.user.email === "string" ? authData.user.email.trim().toLowerCase() : "";
  if (!authenticatedEmail || !authData.user.email_confirmed_at) return NextResponse.json({ error: "Your account must have a verified email address." }, { status: 403 });

  const { data: invite } = await supabase.from("organization_invites").select("*").eq("token", inviteToken).maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  if (String(invite.email).trim().toLowerCase() !== authenticatedEmail) {
    return NextResponse.json({ error: "This invitation was issued to a different email address." }, { status: 403 });
  }
  if (invite.accepted_at) return NextResponse.json({ error: "Invite already accepted." }, { status: 409 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "Invite expired." }, { status: 410 });

  const { error: membershipError } = await supabase.from("organization_members").upsert({
    organization_id: invite.organization_id,
    user_id: authData.user.id,
    role: invite.role,
  }, { onConflict: "organization_id,user_id", ignoreDuplicates: true });
  if (membershipError) return NextResponse.json({ error: "Could not add you to the organization." }, { status: 500 });

  const { data: claimedInvite, error: claimError } = await supabase
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("accepted_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) return NextResponse.json({ error: "Could not accept invitation." }, { status: 500 });
  if (!claimedInvite) return NextResponse.json({ error: "Invite already accepted." }, { status: 409 });

  return NextResponse.json({ ok: true, organizationId: invite.organization_id });
}
