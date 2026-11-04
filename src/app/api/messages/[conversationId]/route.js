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

export async function GET(request, { params }) {
  const { conversationId } = await params;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = client(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { data: messages, error } = await supabase
    .from("messages")
    .select("id,sender_id,body,created_at,edited_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not load messages." }, { status: 500 });

  // Mark read.
  await supabase.from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", authData.user.id);

  return NextResponse.json({ messages: messages || [] });
}

export async function POST(request, { params }) {
  const { conversationId } = await params;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = client(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: authData } = await supabase.auth.getUser(token);
  if (!authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof body?.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }

  const { data: msg, error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: authData.user.id,
    body: body.body.trim(),
  }).select("id,sender_id,body,created_at").single();

  if (error || !msg) return NextResponse.json({ error: "Could not send message." }, { status: 500 });

  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

  return NextResponse.json({ message: msg }, { status: 201 });
}
