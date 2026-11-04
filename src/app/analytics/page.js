"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import Card from "../../components/ui/Card";

const statusLabels = {
  NEW: "Applied", SCREENING: "Screening", INTERVIEW: "Interview",
  OFFER: "Offer", PLACED: "Placed", REJECTED: "Rejected",
};

export default function AnalyticsPage() {
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) { window.location.assign("/login?next=%2Fanalytics"); return; }
      const { data: candidate } = await supabase.from("candidates").select("id").eq("user_id", authData.user.id).maybeSingle();
      if (!candidate) { setCounts({}); setTotal(0); return; }
      const { data, error: appError } = await supabase.from("applications").select("status").eq("candidate_id", candidate.id);
      if (appError) throw appError;
      const next = {};
      for (const row of data || []) next[row.status] = (next[row.status] || 0) + 1;
      setCounts(next);
      setTotal((data || []).length);
    } catch (e) {
      setError(e.message || "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const max = useMemo(() => Math.max(1, ...Object.values(counts)), [counts]);

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Your pipeline</span>
          <h2>Application analytics</h2>
        </div>
        <p>Track how your applications move through the hiring funnel.</p>
      </div>

      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading…</p>}

      <div className="wb-grid" style={{ marginBottom: "var(--wb-space-6)" }}>
        <div className="wb-stat">
          <div className="wb-stat__value">{total}</div>
          <div className="wb-stat__label">Total applications</div>
        </div>
        <div className="wb-stat">
          <div className="wb-stat__value">{counts.INTERVIEW || 0}</div>
          <div className="wb-stat__label">Interviews</div>
        </div>
        <div className="wb-stat">
          <div className="wb-stat__value">{counts.OFFER || 0}</div>
          <div className="wb-stat__label">Offers</div>
        </div>
        <div className="wb-stat">
          <div className="wb-stat__value">{counts.PLACED || 0}</div>
          <div className="wb-stat__label">Placed</div>
        </div>
      </div>

      <Card>
        <h3>Status breakdown</h3>
        <div style={{ display: "grid", gap: "var(--wb-space-3)", marginTop: "var(--wb-space-4)" }}>
          {Object.entries(statusLabels).map(([key, label]) => {
            const value = counts[key] || 0;
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                  <span>{label}</span>
                  <span>{value}</span>
                </div>
                <div className="wb-bar" aria-hidden="true">
                  <span style={{ width: `${(value / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
