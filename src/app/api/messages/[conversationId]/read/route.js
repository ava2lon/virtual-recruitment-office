import { NextResponse } from "next/server";
import { getSessionFromRequest } from "../../../../../lib/oauth/session";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { conversationId } = await params;
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ error: "Messaging service is not configured." }, { status: 503 }); }

  const { data: membership, error: membershipError } = await admin.from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const { data: participants, error } = await admin.from("conversation_participants")
    .select("user_id,last_read_at")
    .eq("conversation_id", conversationId);
  if (error) return NextResponse.json({ error: "Could not load read receipts." }, { status: 500 });

  const reads = {};
  for (const participant of participants || []) reads[participant.user_id] = participant.last_read_at;
  return NextResponse.json({ reads });
}
