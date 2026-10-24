"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";

const columns = [
  { key: "applied", title: "Applied", statuses: ["NEW"] },
  { key: "review", title: "In review", statuses: ["SCREENING", "AI_REVIEW", "RECRUITER_REVIEW", "EMPLOYER_REVIEW", "SHORTLISTED", "ON_HOLD", "NO_RESPONSE"] },
  { key: "interview", title: "Interview", statuses: ["INTERVIEW", "FINAL_INTERVIEW"] },
  { key: "offer", title: "Offer / placed", statuses: ["OFFER", "PLACED"] },
  { key: "closed", title: "Closed", statuses: ["REJECTED", "WITHDRAWN"] },
];

const statusLabels = {
  NEW: "Applied", SCREENING: "Screening", AI_REVIEW: "AI review",
  RECRUITER_REVIEW: "Recruiter review", SHORTLISTED: "Shortlisted",
  EMPLOYER_REVIEW: "Employer review", INTERVIEW: "Interview",
  FINAL_INTERVIEW: "Final interview", OFFER: "Offer", PLACED: "Placed",
  REJECTED: "Not selected", WITHDRAWN: "Withdrawn", NO_RESPONSE: "No response",
  ON_HOLD: "On hold",
};

const blankDetails = () => ({
  cv_version: "", recruiter_contact: "", notes: "", next_action: "", follow_up_at: "",
});

function relation(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function dateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function normalizeDetails(value) {
  const detail = relation(value);
  return detail ? { ...blankDetails(), ...detail, follow_up_at: toLocalInput(detail.follow_up_at) } : blankDetails();
}

export default function ApplicationsPage() {
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [details, setDetails] = useState({});
  const [expanded, setExpanded] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabase();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const currentUser = authData?.user;
      if (!currentUser) {
        window.location.assign("/login?next=%2Fapplications");
        return;
      }
      setUser(currentUser);

      const { data: candidate, error: candidateError } = await supabase
        .from("candidates").select("id").eq("user_id", currentUser.id).maybeSingle();
      if (candidateError) throw candidateError;
      if (!candidate) {
        setApplications([]);
        setDetails({});
        setMessage("Finish creating your candidate profile before tracking applications.");
        return;
      }

      const { data, error: applicationError } = await supabase
        .from("applications")
        .select("id,status,match_score,created_at,job_id,jobs:jobs!applications_job_id_fkey(id,job_title,location,employment_type,company_id,companies:companies!jobs_company_id_fkey(company_name)),tracker:application_tracker_details(id,application_id,candidate_id,cv_version,recruiter_contact,notes,next_action,follow_up_at,updated_at)")
        .eq("candidate_id", candidate.id)
        .eq("candidate_applied", true)
        .order("created_at", { ascending: false });
      if (applicationError) throw applicationError;

      const rows = data || [];
      setApplications(rows);
      const nextDetails = {};
      for (const row of rows) nextDetails[row.id] = normalizeDetails(row.tracker);
      setDetails(nextDetails);
      setMessage("");
    } catch (loadError) {
      setError(loadError.message || "Could not load your applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return applications;
    return applications.filter((application) => {
      const job = relation(application.jobs);
      const company = relation(job?.companies);
      return [job?.job_title, company?.company_name, job?.location, statusLabels[application.status]]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [applications, search]);

  const stats = useMemo(() => {
    const total = applications.length;
    const interviews = applications.filter(a => ["INTERVIEW", "FINAL_INTERVIEW"].includes(a.status)).length;
    const offers = applications.filter(a => ["OFFER", "PLACED"].includes(a.status)).length;
    const progressed = applications.filter(a => !["NEW", "NO_RESPONSE", "ON_HOLD"].includes(a.status)).length;
    return { total, interviews, offers, responseRate: total ? Math.round((progressed / total) * 100) : 0 };
  }, [applications]);

  const reminders = useMemo(() => applications
    .map(application => ({ application, detail: details[application.id] || blankDetails() }))
    .filter(({ detail }) => detail.follow_up_at)
    .map(item => ({ ...item, due: new Date(item.detail.follow_up_at) }))
    .filter(item => !Number.isNaN(item.due.getTime()))
    .sort((a, b) => a.due - b.due), [applications, details]);

  function updateDetail(applicationId, field, value) {
    setDetails(current => ({
      ...current,
      [applicationId]: { ...blankDetails(), ...(current[applicationId] || {}), [field]: value },
    }));
  }

  async function saveDetails(application) {
    const current = details[application.id] || blankDetails();
    setSavingId(application.id);
    setError("");
    setMessage("");
    try {
      const supabase = getSupabase();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData?.user) throw new Error("Your session expired. Sign in and try again.");
      const { data: candidate, error: candidateError } = await supabase
        .from("candidates").select("id").eq("user_id", authData.user.id).single();
      if (candidateError) throw candidateError;
      const payload = {
        application_id: application.id,
        candidate_id: candidate.id,
        cv_version: current.cv_version || "",
        recruiter_contact: current.recruiter_contact || "",
        notes: current.notes || "",
        next_action: current.next_action || "",
        follow_up_at: current.follow_up_at ? new Date(current.follow_up_at).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      const { error: saveError } = await supabase
        .from("application_tracker_details").upsert(payload, { onConflict: "application_id" });
      if (saveError) throw saveError;
      setMessage("Application notes and follow-up saved.");
      await load();
      setExpanded(application.id);
    } catch (saveError) {
      setError("Could not save tracker details: " + (saveError.message || "Check the application tracker migration and permissions."));
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="page-shell application-tracker">
      <div className="page-intro">
        <span className="eyebrow">Your career workspace</span>
        <h1>Application tracker.</h1>
        <p>Keep every application, interview, and next step in one place. Your private notes are visible only to you.</p>
      </div>

      <div className="tracker-stats" aria-label="Application summary">
        <article className="tracker-stat"><span>Applications</span><strong>{stats.total}</strong><small>Submitted roles</small></article>
        <article className="tracker-stat"><span>Interviews</span><strong>{stats.interviews}</strong><small>Interview-stage applications</small></article>
        <article className="tracker-stat"><span>Offers</span><strong>{stats.offers}</strong><small>Offers or placements</small></article>
        <article className="tracker-stat"><span>Progress rate</span><strong>{stats.responseRate}%</strong><small>Moved beyond new / pending</small></article>
      </div>

      <section className="tracker-reminders" aria-labelledby="tracker-reminders-heading">
        <div className="tracker-section-heading"><div><span className="eyebrow">Stay on top of it</span><h2 id="tracker-reminders-heading">Follow-up reminders</h2></div><span className="count-pill">{reminders.length} scheduled</span></div>
        {!reminders.length ? <p className="tracker-muted">Add a follow-up date to an application and it will appear here.</p> : (
          <div className="tracker-reminder-list">
            {reminders.map(({ application, detail, due }) => {
              const job = relation(application.jobs);
              const late = due.getTime() < Date.now();
              return <button type="button" className={"tracker-reminder" + (late ? " is-overdue" : "")} key={application.id} onClick={() => { setExpanded(application.id); document.getElementById("tracker-card-" + application.id)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                <span className="tracker-reminder-date">{dateLabel(detail.follow_up_at)}</span><span className="tracker-reminder-copy"><strong>{job?.job_title || "Untitled role"}</strong><small>{detail.next_action || "Follow up on this application"}</small></span><span className="tracker-reminder-state">{late ? "Overdue" : "Upcoming"}</span>
              </button>;
            })}
          </div>
        )}
      </section>

      <div className="tracker-toolbar">
        <div><strong>Your applications</strong><p>Application status is supplied by the recruitment team.</p></div>
        <label className="tracker-search"><span className="sr-only">Search applications</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search role or company…" /></label>
      </div>

      {loading ? <div className="empty-state">Loading your applications…</div> : error ? <div className="notice" role="alert">{error}<button className="tracker-retry" type="button" onClick={load}>Try again</button></div> : !filtered.length ? (
        <div className="empty-state"><span className="empty-symbol">↗</span><h2>{applications.length ? "No matching applications." : "Your next move starts here."}</h2><p>{applications.length ? "Try another search term." : "When you apply for an open role, your application will appear here. Keep track of status, interview prep, and follow-up actions as you go."}</p><a className="button" href="/matches">Explore jobs</a></div>
      ) : (
        <div className="tracker-board">
          {columns.map(column => {
            const rows = filtered.filter(application => column.statuses.includes(application.status));
            return <section className="tracker-column" key={column.key}>
              <div className="tracker-column-heading"><h2>{column.title}</h2><span>{rows.length}</span></div>
              {!rows.length ? <p className="tracker-column-empty">No applications</p> : rows.map(application => {
                const job = relation(application.jobs);
                const company = relation(job?.companies);
                const detail = details[application.id] || blankDetails();
                const isExpanded = expanded === application.id;
                return <article className="tracker-card" id={"tracker-card-" + application.id} key={application.id}>
                  <div className="tracker-card-top"><span className="tracker-company-mark">{(company?.company_name || job?.job_title || "W").charAt(0).toUpperCase()}</span><span className="tracker-status">{statusLabels[application.status] || application.status}</span></div>
                  <h3>{job?.job_title || "Untitled role"}</h3>
                  <p className="tracker-company">{company?.company_name || "Employer"}{job?.location ? " · " + job.location : ""}</p>
                  <div className="tracker-card-meta"><span>Applied {dateLabel(application.created_at) || "recently"}</span>{application.match_score != null && <span>{Math.round(Number(application.match_score))}% match</span>}</div>
                  {detail.follow_up_at && <p className={"tracker-follow-up" + (new Date(detail.follow_up_at).getTime() < Date.now() ? " is-overdue" : "")}>Follow up: {dateLabel(detail.follow_up_at)}</p>}
                  <button type="button" className="tracker-expand" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? "" : application.id)}>{isExpanded ? "Close notes −" : "Notes & next step +"}</button>
                  {isExpanded && <form className="tracker-detail-form" onSubmit={event => { event.preventDefault(); saveDetails(application); }}>
                    <label>CV version used<input value={detail.cv_version} onChange={event => updateDetail(application.id, "cv_version", event.target.value)} placeholder="e.g. Customer support CV v2" /></label>
                    <label>Recruiter contact<input value={detail.recruiter_contact} onChange={event => updateDetail(application.id, "recruiter_contact", event.target.value)} placeholder="Name, email, or LinkedIn" /></label>
                    <label>Interview / application notes<textarea rows={3} value={detail.notes} onChange={event => updateDetail(application.id, "notes", event.target.value)} placeholder="Questions to prepare, recruiter feedback, key details…" /></label>
                    <label>Next action<input value={detail.next_action} onChange={event => updateDetail(application.id, "next_action", event.target.value)} placeholder="e.g. Send a polite follow-up email" /></label>
                    <label>Follow-up date and time<input type="datetime-local" value={detail.follow_up_at || ""} onChange={event => updateDetail(application.id, "follow_up_at", event.target.value)} /></label>
                    <button className="button tracker-save" type="submit" disabled={savingId === application.id}>{savingId === application.id ? "Saving…" : "Save notes & reminder"}</button>
                  </form>}
                </article>;
              })}
            </section>;
          })}
        </div>
      )}
      {message && <p className="form-message tracker-feedback" role="status">{message}</p>}
      <p className="page-note">Signed in as {user?.email || "checking your account…"} · Application status changes are managed by the employer or recruitment team.</p>
    </section>
  );
}
