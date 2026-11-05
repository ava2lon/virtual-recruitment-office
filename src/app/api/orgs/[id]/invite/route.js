import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionFromRequest } from "../../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await params;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const requestedRole = typeof body?.role === "string" ? body.role : "member";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!["admin", "member", "viewer"].includes(requestedRole)) {
    return NextResponse.json({ error: "Invalid invitation role." }, { status: 400 });
  }

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Invitation service is not configured." }, { status: 503 }); }

  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", id)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "You are not authorized to invite members." }, { status: 403 });
  }
  if (requestedRole === "admin" && membership.role !== "owner") {
    return NextResponse.json({ error: "Only organization owners can grant the admin role." }, { status: 403 });
  }

  const inviteToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invite, error } = await admin.from("organization_invites").insert({
    organization_id: id,
    email,
    role: requestedRole,
    token: inviteToken,
    invited_by: session.sub,
    expires_at: expiresAt,
  }).select("id,token,expires_at").single();

  if (error || !invite) return NextResponse.json({ error: "Could not create invite." }, { status: 500 });
  return NextResponse.json({ invite }, { status: 201 });
}
