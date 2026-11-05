import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";

function client(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = client(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

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

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "You are not authorized to invite members." }, { status: 403 });
  }
  if (requestedRole === "admin" && membership.role !== "owner") {
    return NextResponse.json({ error: "Only organization owners can grant the admin role." }, { status: 403 });
  }
  const role = requestedRole;

  const inviteToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await supabase.from("organization_invites").insert({
    organization_id: id,
    email,
    role,
    token: inviteToken,
    invited_by: authData.user.id,
    expires_at: expiresAt,
  }).select("id,token,expires_at").single();

  if (error || !invite) return NextResponse.json({ error: "Could not create invite." }, { status: 500 });
  return NextResponse.json({ invite }, { status: 201 });
}
