"use client";

import { useState } from "react";
import { getSupabase } from "../../lib/supabase";

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

  return <section className="auth-wrap"><div className="auth-panel"><span className="eyebrow">Get started</span><h1>Make your next move.</h1><p className="muted-text">Create your WorkBridge account in a few steps.</p><form className="form-stack" onSubmit={submit}><label>Full name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required /></label><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label>I’m here as<select value={role} onChange={e => setRole(e.target.value)}><option value="candidate">A candidate</option><option value="employer">An employer</option></select></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required /><small>Use at least 8 characters.</small></label><button className="button button-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>{message && <p className="form-message" role="status">{message}</p>}</form><p className="auth-switch">Already registered? <a href="/login">Log in</a></p></div><aside className="auth-aside"><span className="aside-symbol">✳</span><h2>One platform. Zero friction. One connection.</h2><p>A more considered way to connect people and work.</p></aside></section>;
}
