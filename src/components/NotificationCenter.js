"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

function timeLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function NotificationCenter() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) { setItems([]); return; }
      const { data, error: queryError } = await supabase
        .from("notifications")
        .select("id,notification_type,title,body,link_url,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (queryError) throw queryError;
      setItems(data || []);
      setError("");
    } catch (e) {
      setError(e.message || "Notifications could not be loaded.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function markRead(item) {
    if (item.read_at || busyId) return;
    setBusyId(item.id);
    try {
      const supabase = getSupabase();
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", item.id);
      if (updateError) throw updateError;
      setItems(current => current.map(n => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (e) {
      setError(e.message || "Could not mark notification as read.");
    } finally {
      setBusyId("");
    }
  }

  const unread = items.filter(item => !item.read_at).length;

  return (
    <div className="notification-center">
      <button type="button" className="notification-trigger" aria-label={unread ? "Notifications, " + unread + " unread" : "Notifications"} aria-expanded={open} onClick={() => { setOpen(value => !value); if (!open) refresh(); }}>
        <span aria-hidden="true">♧</span>
        <span className="notification-trigger-label">Alerts</span>
        {unread > 0 && <span className="notification-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notification-popover" role="dialog" aria-label="Your notifications">
          <div className="notification-heading">
            <div><strong>Notifications</strong><span>{unread ? unread + " unread" : "You're all caught up"}</span></div>
            <button type="button" className="notification-refresh" onClick={refresh} aria-label="Refresh notifications">↻</button>
          </div>
          {error && <p className="notification-error" role="status">{error}</p>}
          {!items.length && !error ? <p className="notification-empty">No notifications yet. Updates about your applications and vacancies will appear here.</p> : (
            <div className="notification-list">
              {items.map(item => (
                <article className={"notification-item" + (item.read_at ? "" : " is-unread")} key={item.id}>
                  <span className="notification-dot" aria-hidden="true" />
                  <div className="notification-copy">
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <time dateTime={item.created_at}>{timeLabel(item.created_at)}</time>
                    <div className="notification-actions">
                      {item.link_url && <a href={item.link_url} onClick={() => markRead(item)}>{item.read_at ? "Open" : "View update"} ↗</a>}
                      {!item.read_at && <button type="button" disabled={busyId === item.id} onClick={() => markRead(item)}>{busyId === item.id ? "Saving…" : "Mark read"}</button>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
