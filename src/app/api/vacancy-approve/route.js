import { NextResponse } from "next/server";
import { readJsonObject } from "../../../lib/requestValidation";
import { consumeRateLimit } from "../../../lib/rateLimit";
import { authorizeEmployer, isUuid, postToN8n } from "../../../lib/vacancyN8n";

export const runtime = "nodejs";

export async function POST(request) {
  if (process.env.NEXT_PUBLIC_WORKBRIDGE_PREVIEW_READONLY === "true") {
    return NextResponse.json({ error: "Vacancy approval is disabled in read-only preview deployments." }, { status: 409 });
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { jobId, companyId } = parsed.payload;
  if (!isUuid(jobId) || !isUuid(companyId)) {
    return NextResponse.json({ error: "Valid jobId and companyId values are required." }, { status: 400 });
  }

  const authorization = await authorizeEmployer(request, companyId);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  let rateLimit;
  try {
    rateLimit = await consumeRateLimit("vacancy-approve:" + authorization.user.id, { limit: 20, windowSeconds: 60 });
  } catch {
    return NextResponse.json({ error: "Vacancy rate-limit protection is temporarily unavailable." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((Date.parse(rateLimit.resetAt) - Date.now()) / 1000));
    return NextResponse.json({ error: "Too many vacancy requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  const { data: job, error: jobError } = await authorization.supabase
    .from("jobs")
    .select("id,company_id,job_title,description,location,employment_type,status")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (jobError) return NextResponse.json({ error: "Could not verify the vacancy." }, { status: 503 });
  if (!job) return NextResponse.json({ error: "Vacancy not found in this employer workspace." }, { status: 404 });
  if (job.status === "open") return NextResponse.json({ ok: true, alreadyPublished: true }, { status: 200 });
  if (job.status !== "draft") return NextResponse.json({ error: "Only draft vacancies can be approved." }, { status: 409 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://101.vercel.app").replace(/\/+$/, "");
  const payload = {
    event: "vacancy.approve",
    job_id: job.id,
    company_id: job.company_id,
    approved_by: authorization.user.id,
    company_name: authorization.company.company_name,
    public_url: siteUrl + "/matches#" + encodeURIComponent(job.id),
    job
  };

  const sent = await postToN8n(process.env.WORKBRIDGE_N8N_VACANCY_APPROVAL_WEBHOOK_URL, payload);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });

  return NextResponse.json({ ok: true, queued: true, message: "Vacancy approval sent to n8n." }, { status: 202 });
}
