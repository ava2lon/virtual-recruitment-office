import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

async function getParticipant(admin, conversationId, userId) {
  return admin.from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function GET(request, { params }) {
  const { conversationId } = await params;
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Messaging service is not configured." }, { status: 503 }); }

  const { data: membership, error: membershipError } = await getParticipant(admin, conversationId, session.sub);
  if (membershipError || !membership) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const { data: messages, error } = await admin.from("messages")
    .select("id,sender_id,body,created_at,edited_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load messages." }, { status: 500 });

  await admin.from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", session.sub);

  return NextResponse.json({ messages: messages || [] });
}

export async function POST(request, { params }) {
  const { conversationId } = await params;
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (typeof body?.body !== "string" || !body.body.trim() || body.body.length > 10000) {
    return NextResponse.json({ error: "Message body must contain 1 to 10000 characters." }, { status: 400 });
  }

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Messaging service is not configured." }, { status: 503 }); }

  const { data: membership, error: membershipError } = await getParticipant(admin, conversationId, session.sub);
  if (membershipError || !membership) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const { data: message, error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: session.sub,
    body: body.body.trim(),
  }).select("id,sender_id,body,created_at").single();
  if (error || !message) return NextResponse.json({ error: "Could not send message." }, { status: 500 });

  await admin.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  return NextResponse.json({ message }, { status: 201 });
}
