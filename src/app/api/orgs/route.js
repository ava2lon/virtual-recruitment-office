import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Organization service is not configured." }, { status: 503 }); }

  const { data: memberships, error } = await admin
    .from("organization_members")
    .select("role, organizations(id,name,slug,created_at)")
    .eq("user_id", session.sub);
  if (error) return NextResponse.json({ error: "Could not load organizations." }, { status: 500 });

  const orgs = (memberships || []).map((m) => ({ ...m.organizations, role: m.role }));
  return NextResponse.json({ organizations: orgs });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) return NextResponse.json({ error: "Organization name must be between 1 and 120 characters." }, { status: 400 });

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Organization service is not configured." }, { status: 503 }); }

  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "organization";
  const slug = slugBase + "-" + crypto.randomBytes(3).toString("hex");
  const { data: org, error } = await admin.from("organizations")
    .insert({ name, slug, owner_id: session.sub })
    .select("id,name,slug")
    .single();
  if (error || !org) return NextResponse.json({ error: "Could not create organization." }, { status: 500 });

  const { error: membershipError } = await admin.from("organization_members").insert({
    organization_id: org.id,
    user_id: session.sub,
    role: "owner",
  });
  if (membershipError) {
    await admin.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: "Could not initialize organization ownership." }, { status: 500 });
  }

  return NextResponse.json({ organization: org }, { status: 201 });
}
