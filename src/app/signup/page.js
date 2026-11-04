"use client";

import { useState } from "react";
import { getSupabase } from "../../lib/supabase";

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 20-8.1 20-21 0-1.3-.1-2.7-.4-4z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4.5 24 4.5 16.5 4.5 10 8.6 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 43.5c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 34.6 26.7 35.5 24 35.5c-5.2 0-9.6-3.3-11.2-8l-6.5 5C10 39.4 16.5 43.5 24 43.5z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.3 5.3C41.2 35.3 44 30.1 44 24c0-1.3-.1-2.7-.4-3.5z"/>
  </svg>
);
const FacebookLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>
);

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("candidate");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, role } } });
      if (error) throw error;
      setMessage(data.session ? "Account created. You can continue to your profile." : "Account created. Check your email to confirm your address before logging in.");
    } catch (error) { setMessage(error.message || "Unable to create account."); }
    finally { setBusy(false); }
  }

  async function oauth(provider) {
    setBusy(true); setMessage("");
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + "/auth/callback?next=/profile" },
      });
      if (error) throw error;
    } catch (error) { setMessage(error.message || "Unable to start sign-up."); setBusy(false); }
  }

  return <section className="auth-wrap"><div className="auth-panel"><span className="eyebrow">Get started</span><h1>Make your next move.</h1><p className="muted-text">Create your WorkBridge account in a few steps.</p><div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}><button type="button" className="button button-full" disabled={busy} onClick={() => oauth("google")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><GoogleLogo />Continue with Google</button><button type="button" className="button button-full" disabled={busy} onClick={() => oauth("facebook")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", background: "#1877F2", borderColor: "#1877F2" }}><FacebookLogo />Continue with Facebook</button></div><div style={{ textAlign: "center", color: "var(--wb-color-muted)", fontSize: "0.85rem", margin: "0.5rem 0" }}>or</div><form className="form-stack" onSubmit={submit}><label>Full name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label>I’m here as<select value={role} onChange={e => setRole(e.target.value)}><option value="candidate">A candidate</option><option value="employer">An employer</option></select></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required /><small>Use at least 8 characters.</small></label><button className="button button-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>{message && <p className="form-message" role="status">{message}</p>}</form><p className="auth-switch">Already registered? <a href="/login">Log in</a></p></div><aside className="auth-aside"><span className="aside-symbol">✳</span><h2>One platform. Zero friction. One connection.</h2><p>A more considered way to connect people and work.</p></aside></section>;
}
