"use client";

import { useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign("/profile");
    } catch (error) { setMessage(error.message || "Unable to log in."); }
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
    } catch (error) { setMessage(error.message || "Unable to start sign-in."); setBusy(false); }
  }

  return <section className="auth-wrap"><div className="auth-panel"><span className="eyebrow">Welcome back</span><h1>Good to see you.</h1><p className="muted-text">Log in to continue where your next opportunity begins.</p><div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}><button type="button" className="button button-full" disabled={busy} onClick={() => oauth("google")}>Continue with Google</button><button type="button" className="button button-full" disabled={busy} onClick={() => oauth("facebook")}>Continue with Facebook</button></div><div style={{ textAlign: "center", color: "var(--wb-color-muted)", fontSize: "0.85rem", margin: "0.5rem 0" }}>or</div><form className="form-stack" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="button button-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>{message && <p className="form-message" role="alert">{message}</p>}</form><p className="auth-switch">New to WorkBridge? <a href="/signup">Create an account</a></p></div><aside className="auth-aside"><span className="aside-symbol">↗</span><h2>Your next chapter is closer than you think.</h2><p>Keep your profile current and make room for the right opportunity.</p></aside></section>;
}
