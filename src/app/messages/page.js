"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");

  const api = useCallback(async (path, options = {}) => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const t = data?.session?.access_token || token;
    setToken(t);
    const res = await fetch(path, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: "Bearer " + t, "Content-Type": "application/json" },
    });
    return res;
  }, [token]);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("/api/messages/conversations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load_failed");
      setConversations(data.conversations || []);
      if (!activeId && data.conversations?.length) setActiveId(data.conversations[0].id);
    } catch (e) {
      setError(e.message || "Could not load conversations.");
    } finally {
      setLoading(false);
    }
  }, [api, activeId]);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await api("/api/messages/" + id);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load_failed");
      setMessages(data.messages || []);
    } catch (e) {
      setError(e.message || "Could not load messages.");
    }
  }, [api]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    const supabase = getSupabase();
    const channel = supabase
      .channel("messages:" + activeId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + activeId }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, loadMessages]);

  async function send() {
    if (!draft.trim() || !activeId) return;
    setSending(true);
    try {
      const res = await api("/api/messages/" + activeId, { method: "POST", body: JSON.stringify({ body: draft }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "send_failed");
      setDraft("");
      await loadMessages(activeId);
    } catch (e) {
      setError(e.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Inbox</span>
        <h1>Messages</h1>
        <p>Communicate with candidates, recruiters, and employers.</p>
      </div>

      {error && <p role="alert">{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1rem", minHeight: "400px" }}>
        <aside className="wb-card" style={{ padding: "0.5rem" }}>
          <h3>Conversations</h3>
          {loading && <p>Loading…</p>}
          {!loading && conversations.length === 0 && <p style={{ color: "var(--wb-color-muted)" }}>No conversations yet.</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.5rem",
                    border: "none",
                    background: activeId === c.id ? "var(--wb-color-surface)" : "transparent",
                    borderRadius: "var(--wb-radius-sm)",
                    cursor: "pointer",
                    font: "inherit",
                    color: "var(--wb-color-text)",
                  }}
                >
                  <strong>{c.subject}</strong>
                  {c.last_message && <div style={{ fontSize: "0.8rem", color: "var(--wb-color-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_message.body}</div>}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="wb-card" style={{ display: "flex", flexDirection: "column" }}>
          {!activeId ? (
            <p style={{ color: "var(--wb-color-muted)" }}>Select a conversation.</p>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: "0.5rem", padding: "0.5rem" }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ alignSelf: "flex-start", maxWidth: "80%", padding: "0.5rem 0.75rem", borderRadius: "var(--wb-radius-md)", background: "var(--wb-color-surface)", border: "1px solid var(--wb-color-border)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--wb-color-muted)" }}>{new Date(m.created_at).toLocaleString()}</div>
                    <div>{m.body}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message…"
                  style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "var(--wb-radius-md)", border: "1px solid var(--wb-color-border)", background: "var(--wb-color-bg)", color: "var(--wb-color-text)", font: "inherit" }}
                />
                <button className="button" onClick={send} disabled={sending || !draft.trim()}>
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
