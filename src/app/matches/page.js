"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

export default function MatchesPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from("jobs")
          .select("id,job_title,description,location,employment_type,created_at,companies(company_name)")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        if (active) setJobs(data || []);
      } catch (error) {
        if (active) setMessage(error.message || "Could not load jobs. Check your Supabase jobs table and access policies.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Explore opportunities</span>
        <h1>Find your fit.</h1>
        <p>Explore open vacancies published by employers on WorkBridge and take the next step in your search.</p>
      </div>
      <div className="list-toolbar">
        <div><strong>Open opportunities</strong><p>Recently published roles</p></div>
        <span className="count-pill">{jobs.length} listed</span>
      </div>
      {loading ? <div className="empty-state">Loading opportunities…</div> : message ? <div className="notice">{message}</div> : jobs.length ? (
        <div className="job-list">
          {jobs.map(job => {
            const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
            return (
              <article className="job-card" id={job.id} key={job.id}>
                <div className="job-logo">{(company?.company_name || job.job_title || "W").charAt(0).toUpperCase()}</div>
                <div className="job-main">
                  <span className="job-type">{job.employment_type || "Opportunity"}</span>
                  <h2>{job.job_title || "Untitled role"}</h2>
                  <p>{company?.company_name || "Employer"}{job.location ? " · " + job.location : ""}</p>
                  {job.description && <p className="job-description">{String(job.description).slice(0, 260)}{String(job.description).length > 260 ? "…" : ""}</p>}
                  <span className="job-published">Published {job.created_at ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(job.created_at)) : "recently"}</span>
                </div>
                <a className="text-link" href={"/signup?job=" + encodeURIComponent(job.id)}>Apply ↗</a>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-symbol">✳</span>
          <h2>Your next opportunity starts here.</h2>
          <p>No open vacancies are available to display right now. Check back soon, or create an account to build your profile.</p>
          <a className="button" href="/signup">Create your profile</a>
        </div>
      )}
    </section>
  );
}
