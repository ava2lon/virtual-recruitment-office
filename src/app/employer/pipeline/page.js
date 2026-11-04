"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import Card from "../../../components/ui/Card";

const columns = [
  { key: "NEW", title: "New" },
  { key: "SCREENING", title: "Screening" },
  { key: "INTERVIEW", title: "Interview" },
  { key: "OFFER", title: "Offer" },
  { key: "PLACED", title: "Placed" },
  { key: "REJECTED", title: "Rejected" },
];

export default function EmployerPipelinePage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) { window.location.assign("/login?next=%2Femployer%2Fpipeline"); return; }
      const { data: companies } = await supabase.from("company_members").select("company_id").eq("user_id", authData.user.id);
      const ids = (companies || []).map((c) => c.company_id);
      if (!ids.length) { setApplications([]); return; }
      const { data: jobs } = await supabase.from("jobs").select("id").in("company_id", ids);
      const jobIds = (jobs || []).map((j) => j.id);
      if (!jobIds.length) { setApplications([]); return; }
      const { data, error: appError } = await supabase
        .from("applications")
        .select("id,status,created_at,jobs:jobs!applications_job_id_fkey(job_title),candidates:candidates!applications_candidate_id_fkey(first_name,last_name)")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });
      if (appError) throw appError;
      setApplications(data || []);
    } catch (e) {
      setError(e.message || "Could not load pipeline.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(columns.map((c) => [c.key, []]));
    for (const a of applications) {
      const key = map[a.status] ? a.status : "NEW";
      map[key].push(a);
    }
    return map;
  }, [applications]);

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Employer workspace</span>
          <h2>Hiring pipeline</h2>
        </div>
        <p>Track candidates across every stage of the funnel.</p>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading…</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--wb-space-4)" }}>
        {columns.map((col) => (
          <Card key={col.key}>
            <h3 style={{ margin: 0 }}>{col.title} <span style={{ color: "var(--wb-color-muted)", fontWeight: 400 }}>({grouped[col.key].length})</span></h3>
            <div style={{ display: "grid", gap: "var(--wb-space-2)", marginTop: "var(--wb-space-3)" }}>
              {grouped[col.key].map((a) => {
                const job = a.jobs && (Array.isArray(a.jobs) ? a.jobs[0] : a.jobs);
                const cand = a.candidates && (Array.isArray(a.candidates) ? a.candidates[0] : a.candidates);
                const name = cand ? [cand.first_name, cand.last_name].filter(Boolean).join(" ") || "Candidate" : "Candidate";
                return (
                  <div key={a.id} style={{ padding: "var(--wb-space-2)", border: "1px solid var(--wb-color-border)", borderRadius: "var(--wb-radius-sm)", fontSize: "0.875rem" }}>
                    <div style={{ fontWeight: 600 }}>{name}</div>
                    <div style={{ color: "var(--wb-color-muted)" }}>{job?.job_title || "Role"}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
