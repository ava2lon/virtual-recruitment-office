"use client";

import { useLocalStorage } from "../../lib/useLocalStorage";

export default function SettingsPage() {
  const [density, setDensity] = useLocalStorage("wb-density", "comfortable");
  const [emailDigest, setEmailDigest] = useLocalStorage("wb-email-digest", true);

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Preferences</span>
        <h1>Settings</h1>
        <p>Personalize your WorkBridge experience. Preferences are saved locally.</p>
      </div>

      <div className="wb-card" style={{ display: "grid", gap: "1rem", maxWidth: "480px" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ fontWeight: 600 }}>Layout density</span>
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value)}
            style={{ padding: "0.5rem", borderRadius: "var(--wb-radius-md)", border: "1px solid var(--wb-color-border)", background: "var(--wb-color-bg)", color: "var(--wb-color-text)" }}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={emailDigest}
            onChange={(e) => setEmailDigest(e.target.checked)}
          />
          <span>Receive email digest of application updates</span>
        </label>
      </div>

      <div className="wb-card" style={{ display: "grid", gap: "0.75rem", maxWidth: "480px", marginTop: "1.5rem" }}>
        <h3>Calendar sync</h3>
        <p style={{ color: "var(--wb-color-muted)", fontSize: "0.875rem" }}>Connect your Google Calendar to sync interviews and events.</p>
        <a className="button" href="/api/calendar/google/connect">Connect Google Calendar</a>
      </div>
    </section>
  );
}
