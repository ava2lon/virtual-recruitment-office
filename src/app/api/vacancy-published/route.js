import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  let payload;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "A valid JSON payload is required." }, { status: 400 }); }

  if (!payload || typeof payload.jobId !== "string" || typeof payload.companyId !== "string") {
    return NextResponse.json({ error: "jobId and companyId are required." }, { status: 400 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + token } }
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Your session is invalid or expired." }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("company_id", payload.companyId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Could not verify employer access." }, { status: 403 });
  if (!membership) return NextResponse.json({ error: "You do not have access to this company." }, { status: 403 });

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id,company_id,job_title,description,location,employment_type,status,companies(company_name)")
    .eq("id", payload.jobId)
    .eq("company_id", payload.companyId)
    .maybeSingle();
  if (jobError || !job) return NextResponse.json({ error: "Published vacancy was not found." }, { status: 404 });
  if (job.status !== "open") return NextResponse.json({ error: "Only open vacancies can enter the publishing workflow." }, { status: 409 });

  const webhookUrl = process.env.WORKBRIDGE_N8N_VACANCY_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ ok: true, automationConfigured: false });

  let parsedUrl;
  try { parsedUrl = new URL(webhookUrl); }
  catch { return NextResponse.json({ error: "The vacancy automation webhook URL is invalid." }, { status: 503 }); }
  if (parsedUrl.protocol !== "https:") return NextResponse.json({ error: "The vacancy automation webhook must use HTTPS." }, { status: 503 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://101.vercel.app").replace(/\/+$/, "");
  const jobUrl = siteUrl + "/matches#" + encodeURIComponent(job.id);
  const company = Array.isArray(job.companies) ? job.companies[0] : job.companies;
  const body = {
    event: "vacancy.published",
    job: {
      id: job.id,
      title: job.job_title,
      company_name: company && company.company_name ? company.company_name : "Employer",
      description: job.description,
      location: job.location,
      employment_type: job.employment_type,
      status: job.status,
      url: jobUrl
    },
    published_by: authData.user.id,
    published_at: new Date().toISOString()
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return NextResponse.json({ ok: true, automationConfigured: true, automationQueued: false, warning: "Vacancy published, but the social-copy workflow did not accept the event." });
    return NextResponse.json({ ok: true, automationConfigured: true, automationQueued: true });
  } catch {
    return NextResponse.json({ ok: true, automationConfigured: true, automationQueued: false, warning: "Vacancy published, but the social-copy workflow could not be reached." });
  }
}
