"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("first_name,last_name,email").eq("id", currentUser.id).maybeSingle();
        if (profileError) throw profileError;
        setName([profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || currentUser.user_metadata?.full_name || "");
        const { data: candidate, error: candidateError } = await supabase
          .from("candidates").select("id,location").eq("user_id", currentUser.id).maybeSingle();
        if (candidateError) throw candidateError;
        if (candidate) {
          setLocation(candidate.location || "");
          const { data: skillRows, error: skillsError } = await supabase
            .from("candidate_skills").select("skill").eq("candidate_id", candidate.id);
          if (skillsError) throw skillsError;
          setSkills((skillRows || []).map(row => row.skill).join(", "));
        }
      } catch (error) { if (active) setMessage(error.message || "Could not load profile details."); }
    })();
    return () => { active = false; };
  }, []);

  async function save(event) {
    event.preventDefault();
    if (!user) return;
    setBusy(true); setMessage("");
    try {
      const supabase = getSupabase();
      const parts = name.trim().split(/\\s+/);
      const first_name = parts.shift() || "";
      const last_name = parts.join(" ");
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id, email: user.email, first_name, last_name, updated_at: new Date().toISOString()
      }, { onConflict: "id" });
      if (profileError) throw profileError;

      const { data: candidate, error: candidateError } = await supabase.from("candidates").upsert({
        user_id: user.id, email: user.email, first_name, last_name, location: location.trim() || null,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" }).select("id").single();
      if (candidateError) throw candidateError;

      const nextSkills = [...new Set(skills.split(",").map(s => s.trim()).filter(Boolean))];
      const { error: deleteError } = await supabase.from("candidate_skills").delete().eq("candidate_id", candidate.id);
      if (deleteError) throw deleteError;
      if (nextSkills.length) {
        const { error: skillsError } = await supabase.from("candidate_skills").insert(
          nextSkills.map(skill => ({ candidate_id: candidate.id, skill, source: "candidate" }))
        );
        if (skillsError) throw skillsError;
      }
      setMessage("Profile saved.");
    } catch (error) { setMessage("Could not save profile: " + (error.message || "Check your account permissions.")); }
    finally { setBusy(false); }
  }

  return <section className="page-shell"><div className="page-intro"><span className="eyebrow">Your workspace</span><h1>Your profile.</h1><p>Give employers a clear picture of your experience and where you want to go.</p></div><div className="dashboard-card"><div className="card-heading"><div><h2>Profile details</h2><p>Keep your information accurate and up to date.</p></div><span className="profile-avatar">{(name || user?.email || "W").charAt(0).toUpperCase()}</span></div><form className="form-stack" onSubmit={save}><label>Full name<input value={name} onChange={e => setName(e.target.value)} required /></label><label>Location<input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, country" /></label><label>Skills <small>Separate skills with commas.</small><textarea value={skills} onChange={e => setSkills(e.target.value)} rows={3} placeholder="Communication, research, project management" /></label><button className="button" disabled={busy || !user}>{busy ? "Saving…" : "Save profile"}</button>{message && <p className="form-message" role="status">{message}</p>}</form></div><p className="page-note">Signed in as {user?.email || "checking your account…"}</p></section>;
}
