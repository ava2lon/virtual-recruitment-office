"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState([]);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [activeOrg, setActiveOrg] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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

  const load = useCallback(async () => {
    try {
      const res = await api("/api/orgs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load_failed");
      setOrgs(data.organizations || []);
    } catch (e) {
      setMessage(e.message || "Could not load organizations.");
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  async function createOrg() {
    setBusy(true); setMessage("");
    try {
      const res = await api("/api/orgs", { method: "POST", body: JSON.stringify({ name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "create_failed");
      setName("");
      await load();
      setMessage("Organization created.");
    } catch (e) {
      setMessage(e.message || "Could not create organization.");
    } finally { setBusy(false); }
  }

  async function invite() {
    if (!activeOrg || !inviteEmail) return;
    setBusy(true); setMessage("");
    try {
      const res = await api("/api/orgs/" + activeOrg + "/invite", { method: "POST", body: JSON.stringify({ email: inviteEmail }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "invite_failed");
      setInviteEmail("");
      setMessage("Invite created. Share the token with the user.");
    } catch (e) {
      setMessage(e.message || "Could not create invite.");
    } finally { setBusy(false); }
  }

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Multi-tenant</span>
        <h1>Organizations</h1>
        <p>Create and manage organizations for team collaboration.</p>
      </div>

      {message && <p role="status">{message}</p>}

      <div className="wb-card" style={{ display: "grid", gap: "0.75rem", maxWidth: "480px", marginBottom: "1.5rem" }}>
        <h3>Create organization</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name" style={{ padding: "0.5rem", borderRadius: "var(--wb-radius-md)", border: "1px solid var(--wb-color-border)", background: "var(--wb-color-bg)", color: "var(--wb-color-text)" }} />
        <button className="button" onClick={createOrg} disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create"}</button>
      </div>

      <div className="wb-grid">
        {orgs.map((org) => (
          <div className="wb-card" key={org.id}>
            <h3>{org.name}</h3>
            <p style={{ color: "var(--wb-color-muted)", fontSize: "0.85rem" }}>Role: {org.role}</p>
            <button className="button button-secondary" onClick={() => setActiveOrg(org.id)}>Manage invites</button>
          </div>
        ))}
      </div>

      {activeOrg && (
        <div className="wb-card" style={{ display: "grid", gap: "0.75rem", maxWidth: "480px", marginTop: "1.5rem" }}>
          <h3>Invite member</h3>
          <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" type="email" style={{ padding: "0.5rem", borderRadius: "var(--wb-radius-md)", border: "1px solid var(--wb-color-border)", background: "var(--wb-color-bg)", color: "var(--wb-color-text)" }} />
          <button className="button" onClick={invite} disabled={busy || !inviteEmail.trim()}>{busy ? "Inviting…" : "Send invite"}</button>
        </div>
      )}
    </section>
  );
}
