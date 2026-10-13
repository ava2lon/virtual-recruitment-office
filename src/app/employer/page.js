"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function EmployerPage() {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = getSupabase();
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!currentUser) { window.location.assign("/login"); return; }
    setUser(currentUser);
    const { data: companyRow, error: companyError } = await supabase
      .from("companies").select("id,company_name").eq("contact_email", currentUser.email).maybeSingle();
    if (companyError) throw companyError;
    setCompany(companyRow || null);
    if (!companyRow) { setJobs([]); return; }
    const { data, error: jobsError } = await supabase.from("jobs").select("*")
      .eq("company_id", companyRow.id).order("created_at", { ascending: false }).limit(30);
    if (jobsError) throw jobsError;
    setJobs(data || []);
  }

  useEffect(() => { load().catch(error => setMessage(error.message || "Could not load employer workspace.")); }, []);

  async function publish(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (!company) throw new Error("No company is linked to this account email. Ask an administrator to create or link your company record before publishing vacancies.");
      const supabase = getSupabase();
      const { error } = await supabase.from("jobs").insert({
        job_title: title.trim(), location: location.trim() || null, employment_type: employmentType,
        description: description.trim(), company_id: company.id, status: "open"
      });
      if (error) throw error;
      setTitle(""); setLocation(""); setDescription("");
      setMessage("Vacancy published.");
      await load();
    } catch (error) { setMessage("Could not create vacancy: " + (error.message || "Check your employer permissions.")); }
    finally { setBusy(false); }
  }

  return <section className="page-shell"><div className="page-intro"><span className="eyebrow">Employer workspace</span><h1>Build your team.</h1><p>Bring your vacancy into focus and connect with people ready for their next step.</p></div><div className="employer-layout"><div className="dashboard-card"><div className="card-heading"><div><h2>Create a vacancy</h2><p>{company ? "Publishing as " + company.company_name : "Your employer account must be linked to a company record."}</p></div><span className="card-icon">＋</span></div><form className="form-stack" onSubmit={publish}><label>Job title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Customer Support Specialist" required /></label><label>Location<input value={location} onChange={e => setLocation(e.target.value)} placeholder="Remote or city, country" /></label><label>Employment type<select value={employmentType} onChange={e => setEmploymentType(e.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option><option>Temporary</option></select></label><label>Role description<textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Responsibilities, requirements, and what success looks like…" required /></label><button className="button" disabled={busy || !user || !company}>{busy ? "Saving…" : "Publish vacancy"}</button></form></div><aside className="dashboard-card side-card"><span className="eyebrow">Your activity</span><div className="stat-number">{jobs.length}</div><h3>Your vacancies</h3><p>Roles associated with your linked company.</p><a className="text-link" href="/matches">Browse opportunities ↗</a></aside></div>{message && <p className="form-message page-message" role="status">{message}</p>}</section>;
}
