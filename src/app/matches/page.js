"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { useDebounce } from "../../lib/useDebounce";

export default function MatchesPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);

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

  const q = debouncedQuery.trim().toLowerCase();
  const filtered = q
    ? jobs.filter((job) => {
        const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
        return [job.job_title, company?.company_name, job.location, job.employment_type]
          .some((v) => String(v || "").toLowerCase().includes(q));
      })
    : jobs;

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Explore opportunities</span>
        <h1>Find your fit.</h1>
        <p>Explore open vacancies published by employers on WorkBridge and take the next step in your search.</p>
      </div>
      <div className="list-toolbar">
        <div><strong>Open opportunities</strong><p>Recently published roles</p></div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search roles, companies, locations…"
          aria-label="Search opportunities"
          style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--wb-radius-md)", border: "1px solid var(--wb-color-border)", background: "var(--wb-color-bg)", color: "var(--wb-color-text)", font: "inherit", minWidth: "240px" }}
        />
        <span className="count-pill">{filtered.length} listed</span>
      </div>
      {loading ? <div className="empty-state">Loading opportunities…</div> : message ? <div className="notice">{message}</div> : filtered.length ? (
        <div className="job-list">
          {filtered.map(job => {
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
          <h2>No matching opportunities.</h2>
          <p>Try a different search term, or check back soon.</p>
        </div>
      )}
    </section>
  );
}
