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

  return <section className="auth-wrap"><div className="auth-panel"><span className="eyebrow">Welcome back</span><h1>Good to see you.</h1><p className="muted-text">Log in to continue where your next opportunity begins.</p><form className="form-stack" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label><button className="button button-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>{message && <p className="form-message" role="alert">{message}</p>}</form><p className="auth-switch">New to WorkBridge? <a href="/signup">Create an account</a></p></div><aside className="auth-aside"><span className="aside-symbol">↗</span><h2>Your next chapter is closer than you think.</h2><p>Keep your profile current and make room for the right opportunity.</p></aside></section>;
}
