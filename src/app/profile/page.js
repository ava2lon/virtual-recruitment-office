"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const profileChecks = [
    { label: "Full name", complete: Boolean(name.trim()) },
    { label: "Professional headline", complete: Boolean(headline.trim()) },
    { label: "Location", complete: Boolean(location.trim()) },
    { label: "Skills", complete: Boolean(skills.trim()) },
  ];
  const completedProfileFields = profileChecks.filter(item => item.complete).length;
  const profileCompletion = Math.round((completedProfileFields / profileChecks.length) * 100);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!currentUser) { window.location.assign("/login"); return; }
        if (!active) return;
        setUser(currentUser);
        setName(currentUser.user_metadata?.full_name || "");
        const { data } = await supabase.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
        if (data && active) {
          setName(data.full_name || currentUser.user_metadata?.full_name || "");
          setHeadline(data.headline || "");
          setLocation(data.location || "");
          setSkills(Array.isArray(data.skills) ? data.skills.join(", ") : (data.skills || ""));
        }
      } catch (error) { if (active) setMessage(error.message || "Could not load profile details."); }
    })();
    return () => { active = false; };
  }, []);

  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: name, headline, location, skills: skills.split(",").map(s => s.trim()).filter(Boolean), updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
      setMessage("Profile saved.");
    } catch (error) { setMessage("Could not save profile: " + (error.message || "Please check your profile table schema and permissions.")); }
    finally { setBusy(false); }
  }

  return <section className="page-shell"><div className="page-intro"><span className="eyebrow">Your workspace</span><h1>Your profile.</h1><p>Give employers a clear picture of your experience and where you want to go.</p></div><div className="profile-workspace-grid">
  <aside className="profile-progress-card">
    <div className="profile-progress-top"><span className="eyebrow">Profile strength</span><span className="profile-progress-number">{profileCompletion}%</span></div>
    <div className="profile-progress-track" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileCompletion}><span style={{ width: profileCompletion + "%" }} /></div>
    <h2>{profileCompletion === 100 ? "Looking good." : "Build a stronger first impression."}</h2>
    <p>{profileCompletion === 100 ? "Your core profile details are complete. Keep them current as your experience grows." : "Complete these core details to help employers understand your strengths at a glance."}</p>
    <ul className="profile-checklist">{profileChecks.map(item => <li key={item.label} className={item.complete ? "is-complete" : ""}><span aria-hidden="true">{item.complete ? "✓" : "○"}</span>{item.label}</li>)}</ul>
  </aside>
  <div className="dashboard-card profile-details-card"><div className="card-heading"><div><h2>Profile details</h2><p>Keep your information accurate and up to date.</p></div><span className="profile-avatar">{(name || user?.email || "W").charAt(0).toUpperCase()}</span></div><form className="form-stack" onSubmit={save}><label>Full name<input value={name} onChange={e => setName(e.target.value)} required /></label><label>Professional headline<input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Customer Support Specialist" /></label><label>Location<input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, country" /></label><label>Skills <small>Separate skills with commas.</small><textarea value={skills} onChange={e => setSkills(e.target.value)} rows={3} placeholder="Communication, research, project management" /></label><button className="button" disabled={busy || !user}>{busy ? "Saving…" : "Save profile"}</button>{message && <p className="form-message" role="status">{message}</p>}</form></div></div><p className="page-note">Signed in as {user?.email || "checking your account…"}</p></section>;
}
