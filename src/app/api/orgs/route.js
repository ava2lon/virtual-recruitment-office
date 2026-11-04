import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function client(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + token } },
  });
}

export async function GET(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = client(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id,name,slug,created_at)")
    .eq("user_id", authData.user.id);

  const orgs = (memberships || []).map((m) => ({ ...m.organizations, role: m.role }));
  return NextResponse.json({ organizations: orgs });
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
  const name = (body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);

  const { data: org, error } = await supabase.from("organizations").insert({ name, slug, owner_id: authData.user.id }).select("id,name,slug").single();
  if (error || !org) return NextResponse.json({ error: "Could not create organization." }, { status: 500 });

  await supabase.from("organization_members").insert({ organization_id: org.id, user_id: authData.user.id, role: "owner" });

  return NextResponse.json({ organization: org }, { status: 201 });
}
