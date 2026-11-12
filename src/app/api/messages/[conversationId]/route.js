import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import { readJsonObject } from "../../../../lib/requestValidation";

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
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(conversationId)) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Messaging service is not configured." }, { status: 503 }); }

  const { data: membership, error: membershipError } = await getParticipant(admin, conversationId, session.sub);
  if (membershipError || !membership) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const rawCursorCreatedAt = url.searchParams.get("beforeCreatedAt");
  const rawCursorId = url.searchParams.get("beforeId");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  const hasCursorPart = rawCursorCreatedAt !== null || rawCursorId !== null;
  const cursorDate = rawCursorCreatedAt === null ? null : new Date(rawCursorCreatedAt);
  const cursorTimestampPattern = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,6})?(?:Z|[+-]\\d{2}:\\d{2})$/;
  const validCursorDate = rawCursorCreatedAt !== null && cursorTimestampPattern.test(rawCursorCreatedAt) &&
    Number.isFinite(cursorDate.getTime());
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
      (hasCursorPart && (!rawCursorCreatedAt || !rawCursorId || !validCursorDate || !uuidPattern.test(rawCursorId)))) {
    return NextResponse.json({ error: "Pagination requires limit 1-100 and a valid beforeCreatedAt/beforeId cursor pair." }, { status: 400 });
  }

  let query = admin.from("messages")
    .select("id,sender_id,body,created_at,edited_at")
    .eq("conversation_id", conversationId);
  if (hasCursorPart) {
    query = query.or(`created_at.lt.${rawCursorCreatedAt},and(created_at.eq.${rawCursorCreatedAt},id.lt.${rawCursorId})`);
  }
  const { data: pageMessages, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  const hasMore = (pageMessages || []).length > limit;
  const messages = (pageMessages || []).slice(0, limit).reverse();
  const oldestMessage = messages[0];
  const nextCursor = hasMore && oldestMessage
    ? { beforeCreatedAt: oldestMessage.created_at, beforeId: oldestMessage.id }
    : null;

  await admin.from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", session.sub);

  return NextResponse.json({ messages: messages || [], pagination: { limit, hasMore, nextCursor } });
}

export async function POST(request, { params }) {
  const { conversationId } = await params;
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(conversationId)) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.payload;
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
