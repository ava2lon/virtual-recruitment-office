"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagePage, setMessagePage] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [readReceipts, setReadReceipts] = useState({});

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

  const loadMessages = useCallback(async (id, page = 0, append = false) => {
    if (!id) return;
    try {
      const res = await api("/api/messages/" + id + "?page=" + page + "&limit=50");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load_failed");
      setMessages((prev) => append ? [...(data.messages || []), ...prev] : (data.messages || []));
      setMessagePage(page);
      setHasOlderMessages(Boolean(data.pagination?.hasMore));
      // fetch read receipts
      const supabase = getSupabase();
      const { data: session } = await supabase.auth.getSession();
      const t = session?.session?.access_token;
      const r = await fetch("/api/messages/" + id + "/read", { headers: { Authorization: "Bearer " + t } });
      if (r.ok) {
        const rd = await r.json();
        setReadReceipts(rd.reads || {});
      }
    } catch (e) {
      setError(e.message || "Could not load messages.");
    } finally {
      if (append) setLoadingOlder(false);
    }
  }, [api]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    setMessagePage(0);
    setHasOlderMessages(false);
    loadMessages(activeId, 0, false);
    const supabase = getSupabase();
    const channel = supabase
      .channel("presence:" + activeId, { config: { presence: { key: token || "anon" } } })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + activeId }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typing = [];
        Object.keys(state).forEach((key) => {
          (state[key] || []).forEach((p) => { if (p.typing && p.user !== (token || "anon")) typing.push(p.user || "Someone"); });
        });
        setTypingUsers(Array.from(new Set(typing)));
      })
      .on("broadcast", { event: "read" }, ({ payload }) => {
        setReadReceipts((prev) => ({ ...prev, [payload.user]: payload.at }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user: token || "anon", typing: false, online_at: new Date().toISOString() });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [activeId, loadMessages, token]);

  async function send() {
    if (!draft.trim() || !activeId) return;
    setSending(true);
    try {
      const res = await api("/api/messages/" + activeId, { method: "POST", body: JSON.stringify({ body: draft }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "send_failed");
      setDraft("");
      await loadMessages(activeId);
      const supabase2 = getSupabase();
      const ch2 = supabase2.channel("presence:" + activeId);
      ch2.send({ type: "broadcast", event: "read", payload: { user: token || "anon", at: new Date().toISOString() } }).catch(() => {});
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
                {hasOlderMessages && (
                  <button type="button" className="button button-secondary" disabled={loadingOlder} onClick={() => { setLoadingOlder(true); loadMessages(activeId, messagePage + 1, true); }}>
                    {loadingOlder ? "Loading older messages…" : "Load older messages"}
                  </button>
                )}
                {messages.map((m) => (
                  <div key={m.id} style={{ alignSelf: "flex-start", maxWidth: "80%", padding: "0.5rem 0.75rem", borderRadius: "var(--wb-radius-md)", background: "var(--wb-color-surface)", border: "1px solid var(--wb-color-border)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--wb-color-muted)" }}>{new Date(m.created_at).toLocaleString()}</div>
                    <div>{m.body}</div>
                  </div>
                ))}
              </div>
              {Object.keys(readReceipts).length > 0 && (
                <div style={{ fontSize: "0.75rem", color: "var(--wb-color-muted)", textAlign: "right", marginTop: "0.25rem" }}>
                  Read {Object.values(readReceipts).length > 1 ? "by all" : ""}
                </div>
              )}
              {typingUsers.length > 0 && <div style={{ fontSize: "0.8rem", color: "var(--wb-color-muted)", fontStyle: "italic" }}>{typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…</div>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    const supabase = getSupabase();
                    const ch = supabase.channel("presence:" + activeId);
                    ch.track({ user: token || "anon", typing: e.target.value.length > 0, online_at: new Date().toISOString() }).catch(() => {});
                  }}
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
