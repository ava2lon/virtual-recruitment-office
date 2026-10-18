"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";

const employerStatuses = [
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "FINAL_INTERVIEW", label: "Final interview" },
  { value: "OFFER", label: "Offer" },
  { value: "PLACED", label: "Hired / placed" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "REJECTED", label: "Rejected" }
];

function labelStatus(status) {
  return {
    NEW: "New",
    SCREENING: "Screening",
    AI_REVIEW: "AI review",
    RECRUITER_REVIEW: "Recruiter review",
    EMPLOYER_REVIEW: "Awaiting employer review",
    SHORTLISTED: "Shortlisted",
    INTERVIEW: "Interview",
    FINAL_INTERVIEW: "Final interview",
    OFFER: "Offer",
    PLACED: "Placed",
    REJECTED: "Rejected",
    WITHDRAWN: "Withdrawn",
    NO_RESPONSE: "No response",
    ON_HOLD: "On hold"
  }[status] || status || "Unknown";
}

function candidateName(candidate) {
  if (!candidate) return "Candidate profile";
  const name = [candidate.first_name, candidate.last_name].filter(Boolean).join(" ").trim();
  return name || candidate.email || "Candidate profile";
}

export default function EmployerPage() {
  const previewReadOnly = process.env.NEXT_PUBLIC_WORKBRIDGE_PREVIEW_READONLY === "true";
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [description, setDescription] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) { window.location.assign("/login"); return; }
    setUser(authData.user);

    const { data: memberships, error: membershipError } = await supabase
      .from("company_members")
      .select("company_id,role")
      .eq("user_id", authData.user.id);
    if (membershipError) throw membershipError;
    const ids = (memberships || []).map(item => item.company_id);
    if (!ids.length) {
      setCompanies([]);
      setJobs([]);
      setApplications([]);
      setMessage("This account is not linked to an employer workspace yet. Ask your workspace administrator to add you as a company member.");
      return;
    }

    const { data: companyRows, error: companiesError } = await supabase
      .from("companies")
      .select("id,company_name")
      .in("id", ids)
      .order("company_name");
    if (companiesError) throw companiesError;
    const availableCompanies = companyRows || [];
    setCompanies(availableCompanies);
    const selectedId = ids.includes(companyId) ? companyId : (availableCompanies[0]?.id || ids[0]);
    setCompanyId(selectedId);

    const { data: jobRows, error: jobsError } = await supabase
      .from("jobs")
      .select("id,company_id,job_title,description,location,employment_type,status,created_at")
      .in("company_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    if (jobsError) throw jobsError;
    const safeJobs = jobRows || [];
    setJobs(safeJobs);
    const jobIds = safeJobs.map(job => job.id);
    if (!jobIds.length) { setApplications([]); return; }

    const { data: applicationRows, error: applicationsError } = await supabase
      .from("applications")
      .select("id,job_id,candidate_id,status,candidate_applied,created_at,updated_at,match_score,recruiter_notes,candidates(first_name,last_name,email,location,years_experience)")
      .in("job_id", jobIds)
      .eq("candidate_applied", true)
      .order("created_at", { ascending: false })
      .limit(300);
    if (applicationsError) throw applicationsError;
    setApplications(applicationRows || []);
    setMessage("");
  }, [companyId]);

  useEffect(() => {
    let active = true;
    load().catch(error => { if (active) setMessage(error.message || "Could not load employer workspace."); });
    return () => { active = false; };
  }, [load]);

  async function publish(event) {
    event.preventDefault();
    if (previewReadOnly) { setMessage("This preview is read-only because it shares the live WorkBridge database. Publishing and candidate status changes are disabled here."); return; }
    if (!companyId) { setMessage("Choose an employer workspace before publishing."); return; }
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from("jobs").insert({
        company_id: companyId,
        job_title: title.trim(),
        location: location.trim() || null,
        employment_type: employmentType,
        description: description.trim(),
        required_skills: requiredSkills.split(",").map(value => value.trim()).filter(Boolean),
        status: "open"
      }).select("id,company_id,job_title").single();
      if (error) throw error;

      let automationMessage = "Vacancy published on WorkBridge.";
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) {
        try {
          const response = await fetch("/api/vacancy-published", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: "Bearer " + sessionData.session.access_token
            },
            body: JSON.stringify({ jobId: data.id, companyId: data.company_id })
          });
          const result = await response.json();
          if (response.ok && result.automationQueued) {
            automationMessage += " Social-copy draft sent to the configured review workflow.";
          } else if (response.ok && !result.automationConfigured) {
            automationMessage += " Social-copy automation will start once the n8n webhook is configured.";
          } else if (result.warning) {
            automationMessage += " " + result.warning;
          } else if (!response.ok) {
            automationMessage += " Social-copy automation needs configuration; the vacancy itself is live.";
          }
        } catch {
          automationMessage += " Social-copy automation could not be reached; the vacancy itself is live.";
        }
      }
      setTitle("");
      setLocation("");
      setDescription("");
      setRequiredSkills("");
      setMessage(automationMessage);
      await load();
    } catch (error) {
      setMessage("Could not publish vacancy: " + (error.message || "Check the job schema and employer permissions."));
    } finally {
      setBusy(false);
    }
  }

  async function updateApplication(application, status) {
    if (previewReadOnly || updatingId) return;
    setUpdatingId(application.id);
    setMessage("");
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("applications")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", application.id)
        .eq("status", application.status)
        .select("id,status")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No application was updated. Refresh the pipeline and confirm that the candidate is still awaiting employer review.");
      setApplications(current => current.map(item => item.id === application.id ? { ...item, status } : item));
      setMessage("Candidate moved to " + labelStatus(status) + ".");
    } catch (error) {
      setMessage("Could not update candidate status: " + (error.message || "Check employer permissions."));
    } finally {
      setUpdatingId("");
    }
  }

  const companyJobs = useMemo(() => jobs.filter(job => job.company_id === companyId), [jobs, companyId]);
  const companyJobIds = useMemo(() => new Set(companyJobs.map(job => job.id)), [companyJobs]);
  const visibleApplications = useMemo(() => applications.filter(item => companyJobIds.has(item.job_id)), [applications, companyJobIds]);
  const transitions = {
    NEW: ["SHORTLISTED", "INTERVIEW", "ON_HOLD", "REJECTED"],
    SCREENING: ["SHORTLISTED", "INTERVIEW", "ON_HOLD", "REJECTED"],
    AI_REVIEW: ["SHORTLISTED", "INTERVIEW", "ON_HOLD", "REJECTED"],
    RECRUITER_REVIEW: ["SHORTLISTED", "INTERVIEW", "ON_HOLD", "REJECTED"],
    EMPLOYER_REVIEW: ["SHORTLISTED", "INTERVIEW", "ON_HOLD", "REJECTED"],
    SHORTLISTED: ["INTERVIEW", "ON_HOLD", "REJECTED"],
    INTERVIEW: ["FINAL_INTERVIEW", "OFFER", "ON_HOLD", "REJECTED"],
    FINAL_INTERVIEW: ["OFFER", "ON_HOLD", "REJECTED"],
    OFFER: ["PLACED", "ON_HOLD", "REJECTED"],
    ON_HOLD: ["SHORTLISTED", "INTERVIEW", "REJECTED"]
  };
  const stages = [
    { title: "In review", statuses: ["NEW", "SCREENING", "AI_REVIEW", "RECRUITER_REVIEW", "EMPLOYER_REVIEW"] },
    { title: "Shortlisted", statuses: ["SHORTLISTED"] },
    { title: "Interview", statuses: ["INTERVIEW", "FINAL_INTERVIEW"] },
    { title: "Offer", statuses: ["OFFER"] },
    { title: "Hired", statuses: ["PLACED"] },
    { title: "On hold", statuses: ["ON_HOLD"] },
    { title: "Closed out", statuses: ["REJECTED", "WITHDRAWN", "NO_RESPONSE"] }
  ];

  return (
    <section className="page-shell">
      <div className="page-intro">
        <span className="eyebrow">Employer workspace</span>
        <h1>Build your team.</h1>
        <p>Publish vacancies, review applicants, and move candidates through a clear hiring pipeline.</p>
      </div>

      {companies.length > 0 && (
        <div className="workspace-switcher">
          <label htmlFor="company-workspace">Employer workspace</label>
          <select id="company-workspace" value={companyId} onChange={event => setCompanyId(event.target.value)}>
            {companies.map(company => <option key={company.id} value={company.id}>{company.company_name}</option>)}
          </select>
          <span>{companyJobs.length} vacancies · {visibleApplications.length} applicants</span>
        </div>
      )}

      {previewReadOnly && <p className="preview-readonly-note" role="status">Preview mode: read-only to protect live vacancies, candidate records, and notifications.</p>}

      <div className="employer-layout">
        <div className="dashboard-card">
          <div className="card-heading">
            <div><h2>Publish a vacancy</h2><p>Live roles appear in Find jobs as soon as they are saved.</p></div>
            <span className="card-icon">＋</span>
          </div>
          <form className="form-stack" onSubmit={publish}>
            <label>Job title<input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Customer Support Specialist" required /></label>
            <label>Location<input value={location} onChange={event => setLocation(event.target.value)} placeholder="Remote or city, country" /></label>
            <label>Employment type<select value={employmentType} onChange={event => setEmploymentType(event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option><option>Temporary</option></select></label>
            <label>Required skills <small>Optional; separate skills with commas.</small><input value={requiredSkills} onChange={event => setRequiredSkills(event.target.value)} placeholder="Customer service, communication" /></label>
            <label>Role description<textarea rows={5} value={description} onChange={event => setDescription(event.target.value)} placeholder="Responsibilities, requirements, and what success looks like…" required /></label>
            <button className="button" disabled={previewReadOnly || busy || !user || !companyId}>{previewReadOnly ? "Publishing disabled in preview" : busy ? "Publishing…" : "Publish vacancy"}</button>
          </form>
        </div>

        <aside className="dashboard-card side-card">
          <span className="eyebrow">Hiring snapshot</span>
          <div className="stat-number">{companyJobs.length}</div>
          <h3>Vacancies</h3>
          <p>{companyJobs.filter(job => job.status === "open").length} open to candidates</p>
          <div className="mini-stat-row"><span>Applicants</span><strong>{visibleApplications.length}</strong></div>
          <div className="mini-stat-row"><span>Awaiting your review</span><strong>{visibleApplications.filter(item => item.status === "EMPLOYER_REVIEW").length}</strong></div>
          <a className="text-link" href="/matches">Browse public vacancies ↗</a>
        </aside>
      </div>

      <section className="pipeline-section" aria-labelledby="pipeline-title">
        <div className="pipeline-heading">
          <div><span className="eyebrow">Applicant tracking</span><h2 id="pipeline-title">Hiring pipeline</h2><p>Applications submitted by candidates for this workspace.</p></div>
          <span className="count-pill">{visibleApplications.length} applicants</span>
        </div>
        {!companies.length ? (
          <div className="empty-state"><h2>Employer workspace needed</h2><p>{message || "Your account needs to be connected to a company before you can publish roles or review candidates."}</p></div>
        ) : !visibleApplications.length ? (
          <div className="empty-state"><span className="empty-symbol">✳</span><h2>Your pipeline starts here.</h2><p>When candidates apply to one of your open vacancies, their applications will appear here.</p></div>
        ) : (
          <div className="pipeline-columns">
            {stages.map(stage => {
              const stageApplications = visibleApplications.filter(application => stage.statuses.includes(application.status));
              return (
                <section className="pipeline-column" key={stage.title}>
                  <div className="pipeline-column-heading"><h3>{stage.title}</h3><span>{stageApplications.length}</span></div>
                  {stageApplications.length ? stageApplications.map(application => {
                    const job = jobs.find(item => item.id === application.job_id);
                    const candidate = application.candidates;
                    return (
                      <article className="applicant-card" key={application.id}>
                        <div className="applicant-avatar">{candidateName(candidate).charAt(0).toUpperCase()}</div>
                        <strong>{candidateName(candidate)}</strong>
                        <span className="applicant-job">{job?.job_title || "Vacancy"}</span>
                        {candidate?.location && <span className="applicant-meta">{candidate.location}</span>}
                        {candidate?.years_experience != null && <span className="applicant-meta">{candidate.years_experience} years experience</span>}
                        {application.match_score != null && <span className="match-score">{Math.round(Number(application.match_score))}% match</span>}
                        <span className="application-status">{labelStatus(application.status)}</span>
                        {(transitions[application.status] || []).length > 0 ? (
                          <div className="applicant-actions">
                            <label className="sr-only" htmlFor={"status-" + application.id}>Move candidate</label>
                            <select id={"status-" + application.id} defaultValue="" disabled={previewReadOnly || updatingId === application.id} onChange={event => { if (event.target.value) updateApplication(application, event.target.value); }}>
                              <option value="" disabled>Move candidate…</option>
                              {employerStatuses.filter(option => transitions[application.status]?.includes(option.value)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          </div>
                        ) : null}
                        {application.recruiter_notes && <p className="applicant-notes">{application.recruiter_notes}</p>}
                      </article>
                    );
                  }) : <p className="pipeline-empty">No candidates yet</p>}
                </section>
              );
            })}
          </div>
        )}
      </section>
      {message && <p className="form-message page-message" role="status">{message}</p>}
      <p className="page-note">Signed in as {user?.email || "checking your account…"}</p>
    </section>
  );
}
