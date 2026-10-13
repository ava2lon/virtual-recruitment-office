"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function MatchesPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyJobId, setBusyJobId] = useState("");
  const [appliedIds, setAppliedIds] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from("jobs")
          .select("id,job_title,description,location,employment_type,required_skills,experience_min,created_at,companies(company_name)")
          .eq("status", "open").order("created_at", { ascending: false }).limit(30);
        if (error) throw error;
        if (active) setJobs(data || []);
      } catch (error) { if (active) setMessage(error.message || "Could not load open jobs. Check your access policies."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  async function apply(job) {
    setBusyJobId(job.id); setMessage("");
    try {
      const supabase = getSupabase();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { window.location.assign("/login"); return; }
      const { data: candidate, error: candidateError } = await supabase.from("candidates")
        .select("id").eq("user_id", user.id).maybeSingle();
      if (candidateError) throw candidateError;
      if (!candidate) { window.location.assign("/profile"); return; }
      const { data: existing, error: existingError } = await supabase.from("applications")
        .select("id").eq("candidate_id", candidate.id).eq("job_id", job.id).limit(1);
      if (existingError) throw existingError;
      if (existing?.length) {
        setAppliedIds(ids => ids.includes(job.id) ? ids : [...ids, job.id]);
        setMessage("You have already applied for " + job.job_title + ".");
        return;
      }
      const { error: insertError } = await supabase.from("applications").insert({
        candidate_id: candidate.id, job_id: job.id, candidate_applied: true, status: "NEW", source: "workbridge"
      });
      if (insertError) throw insertError;
      setAppliedIds(ids => [...ids, job.id]);
      setMessage("Application submitted for " + job.job_title + ".");
    } catch (error) {
      setMessage("Could not submit application: " + (error.message || "Check your profile and account permissions."));
    } finally { setBusyJobId(""); }
  }

  return <section className="page-shell"><div className="page-intro"><span className="eyebrow">Explore opportunities</span><h1>Find your fit.</h1><p>Explore the opportunities available on WorkBridge and take the next step in your search.</p></div><div className="list-toolbar"><div><strong>Open opportunities</strong><p>Recently added roles</p></div><span className="count-pill">{jobs.length} listed</span></div>{message && <p className="form-message page-message" role="status">{message}</p>}{loading ? <div className="empty-state">Loading opportunities…</div> : message.startsWith("Could not load") ? <div className="notice">{message}</div> : jobs.length ? <div className="job-list">{jobs.map((job, index) => { const companyName = job.companies?.company_name || "Employer"; const title = job.job_title || "Untitled role"; const applied = appliedIds.includes(job.id); return <article className="job-card" key={job.id || index}><div className="job-logo">{companyName.charAt(0).toUpperCase()}</div><div className="job-main"><span className="job-type">{job.employment_type || "Opportunity"}</span><h2>{title}</h2><p>{companyName}{job.location ? " · " + job.location : ""}</p>{job.description && <p className="job-description">{String(job.description).slice(0, 220)}{String(job.description).length > 220 ? "…" : ""}</p>}</div><button className="button" onClick={() => apply(job)} disabled={busyJobId === job.id || applied}>{busyJobId === job.id ? "Submitting…" : applied ? "Applied" : "Apply now"}</button></article>; })}</div> : <div className="empty-state"><span className="empty-symbol">✳</span><h2>Your next opportunity starts here.</h2><p>No open jobs are available to display right now. Check back soon, or create an account to build your profile.</p><a className="button" href="/signup">Create your profile</a></div>}</section>;
}
