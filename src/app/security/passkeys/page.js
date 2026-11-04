"use client";

import { useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

export default function PasskeysPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function register() {
    setBusy(true); setMessage("");
    try {
      const optsRes = await fetch("/api/auth/webauthn/register/options", { method: "POST" });
      const options = await optsRes.json();
      if (!optsRes.ok) throw new Error(options.error || "options_failed");
      const attResp = await startRegistration(options);
      const verifyRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error || "verify_failed");
      setMessage("Passkey registered successfully.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "registration_failed");
    } finally { setBusy(false); }
  }

  async function authenticate() {
    setBusy(true); setMessage("");
    try {
      const optsRes = await fetch("/api/auth/webauthn/authenticate/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const options = await optsRes.json();
      if (!optsRes.ok) throw new Error(options.error || "options_failed");
      const authResp = await startAuthentication(options);
      const verifyRes = await fetch("/api/auth/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authResp),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data.error || "verify_failed");
      setMessage("Passkey authentication successful.");
      window.location.assign("/dashboard");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "authentication_failed");
    } finally { setBusy(false); }
  }

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Security</span>
        <h1>Passkeys (WebAuthn)</h1>
        <p>Register and use passkeys for passwordless, phishing-resistant sign-in.</p>
      </div>
      <div className="wb-card" style={{ display: "grid", gap: "1rem", maxWidth: "480px" }}>
        <button className="button" onClick={register} disabled={busy}>{busy ? "Working…" : "Register passkey"}</button>
        <button className="button button-secondary" onClick={authenticate} disabled={busy}>{busy ? "Working…" : "Sign in with passkey"}</button>
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}
