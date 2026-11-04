"use client";

import { useState } from "react";

export default function MfaPage() {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function enroll() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "enroll_failed");
      setQr(data.qrDataUrl);
      setSecret(data.secret);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "enroll_failed");
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/auth/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "verify_failed");
      setRecovery(data.recoveryCodes);
      setMessage("MFA enabled successfully.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "verify_failed");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/auth/mfa/disable", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "disable_failed");
      setQr(null); setSecret(null); setRecovery(null);
      setMessage("MFA disabled.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "disable_failed");
    } finally { setBusy(false); }
  }

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Security</span>
        <h1>Multi-factor authentication</h1>
        <p>Protect your account with a time-based one-time password (TOTP).</p>
      </div>

      <div className="wb-card" style={{ display: "grid", gap: "1rem", maxWidth: "520px" }}>
        {!qr && (
          <button className="button" onClick={enroll} disabled={busy}>
            {busy ? "Starting…" : "Enroll MFA"}
          </button>
        )}
        {qr && (
          <>
            <p>Scan this QR code with your authenticator app:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="MFA QR code" width={200} height={200} />
            {secret && <p style={{ wordBreak: "break-all", fontSize: "0.85rem" }}>Manual secret: <code>{secret}</code></p>}
            <label>Enter the 6-digit code from your app
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
            </label>
            <button className="button" onClick={verify} disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify & enable"}
            </button>
          </>
        )}
        {recovery && (
          <div>
            <p><strong>Save these recovery codes in a safe place:</strong></p>
            <ul>{recovery.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
          </div>
        )}
        <button className="button" onClick={disable} disabled={busy} style={{ background: "var(--wb-color-danger)", color: "#fff" }}>
          Disable MFA
        </button>
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}
