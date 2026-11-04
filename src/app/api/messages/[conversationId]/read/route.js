import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function client(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: "Bearer " + token } } });
}

export async function GET(request, { params }) {
  const { conversationId } = await params;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = client(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { data: participants } = await supabase
    .from("conversation_participants")
    .select("user_id, last_read_at")
    .eq("conversation_id", conversationId);

  const reads = {};
  for (const p of participants || []) reads[p.user_id] = p.last_read_at;
  return NextResponse.json({ reads });
}
