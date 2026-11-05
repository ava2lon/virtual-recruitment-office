import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

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

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const { data: participations, error: participationError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at, conversations(id,subject,created_at,updated_at)")
    .eq("user_id", authData.user.id);
  if (participationError) return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });

  const ids = (participations || []).map((p) => p.conversation_id);
  if (ids.length === 0) return NextResponse.json({ conversations: [] });

  const { data: lastMessages, error: messageError } = await supabase
    .from("messages")
    .select("id,conversation_id,body,created_at,sender_id")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });
  if (messageError) return NextResponse.json({ error: "Could not load conversation activity." }, { status: 500 });

  const latestByConv = {};
  for (const m of lastMessages || []) {
    if (!latestByConv[m.conversation_id]) latestByConv[m.conversation_id] = m;
  }

  const conversations = (participations || []).map((p) => ({
    id: p.conversation_id,
    subject: p.conversations?.subject || "Conversation",
    updated_at: p.conversations?.updated_at,
    last_message: latestByConv[p.conversation_id] || null,
    last_read_at: p.last_read_at,
  }));

  return NextResponse.json({ conversations });
}

export async function POST(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const supabase = client(token);
  if (!supabase) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const participantIds = Array.isArray(body?.participantIds) ? body.participantIds : [];
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const initialMessage = typeof body?.message === "string" ? body.message.trim() : "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (participantIds.length > 49 || participantIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))) {
    return NextResponse.json({ error: "Participant list is invalid or exceeds 49 additional participants." }, { status: 400 });
  }
  if (subject.length > 200 || initialMessage.length > 10000) {
    return NextResponse.json({ error: "Subject or initial message exceeds the allowed length." }, { status: 400 });
  }

  const allParticipants = Array.from(new Set([authData.user.id, ...participantIds]));
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .insert({ subject: subject || null, created_by: authData.user.id })
    .select("id")
    .single();
  if (convError || !conv) return NextResponse.json({ error: "Could not create conversation." }, { status: 500 });

  const { error: participantsError } = await supabase.from("conversation_participants").insert(
    allParticipants.map((uid) => ({ conversation_id: conv.id, user_id: uid }))
  );
  if (participantsError) {
    try { await getSupabaseAdmin().from("conversations").delete().eq("id", conv.id); } catch {}
    return NextResponse.json({ error: "Could not add conversation participants." }, { status: 500 });
  }

  if (initialMessage) {
    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: authData.user.id,
      body: initialMessage,
    });
    if (messageError) {
      try { await getSupabaseAdmin().from("conversations").delete().eq("id", conv.id); } catch {}
      return NextResponse.json({ error: "Could not create the initial message." }, { status: 500 });
    }
  }

  return NextResponse.json({ conversationId: conv.id }, { status: 201 });
}
