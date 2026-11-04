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
  const email = (body?.email || "").trim().toLowerCase();
  const role = body?.role || "member";
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const inviteToken = crypto.randomBytes(24).toString("hex");
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
