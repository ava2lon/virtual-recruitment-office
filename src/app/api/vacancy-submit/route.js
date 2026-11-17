import { NextResponse } from "next/server";
import { readJsonObject } from "../../../lib/requestValidation";
import { authorizeEmployer, isUuid, postToN8n } from "../../../lib/vacancyN8n";

export const runtime = "nodejs";

const EMPLOYMENT_TYPES = new Set(["Full-time", "Part-time", "Contract", "Internship", "Temporary"]);

function optionalNumber(value, fieldName) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000000000000) {
    throw new Error(fieldName + " must be a non-negative number.");
  }
  return number;
}

function stringList(value, fieldName) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 40 || value.some(item => typeof item !== "string")) {
    throw new Error(fieldName + " must be an array of up to 40 strings.");
  }
  return value.map(item => item.trim()).filter(Boolean).map(item => item.slice(0, 100));
}

export async function POST(request) {
  if (process.env.NEXT_PUBLIC_WORKBRIDGE_PREVIEW_READONLY === "true") {
    return NextResponse.json({ error: "Vacancy submission is disabled in read-only preview deployments." }, { status: 409 });
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const body = parsed.payload;
  const companyId = body.companyId;
  const organizationId = body.organizationId || null;
  if (!isUuid(companyId) || (organizationId && !isUuid(organizationId))) {
    return NextResponse.json({ error: "Valid companyId and organizationId values are required." }, { status: 400 });
  }

  const source = body.job;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return NextResponse.json({ error: "A job object is required." }, { status: 400 });
  }

  const jobTitle = typeof source.job_title === "string" ? source.job_title.trim() : "";
  const description = typeof source.description === "string" ? source.description.trim() : "";
  const location = typeof source.location === "string" ? source.location.trim() : "";
  const employmentType = typeof source.employment_type === "string" ? source.employment_type.trim() : "Full-time";

  if (jobTitle.length < 3 || jobTitle.length > 160) {
    return NextResponse.json({ error: "Job title must be between 3 and 160 characters." }, { status: 400 });
  }
  if (description.length < 20 || description.length > 12000) {
    return NextResponse.json({ error: "Job description must be between 20 and 12,000 characters." }, { status: 400 });
  }
  if (location.length > 160) return NextResponse.json({ error: "Location must not exceed 160 characters." }, { status: 400 });
  if (!EMPLOYMENT_TYPES.has(employmentType)) return NextResponse.json({ error: "Choose a valid employment type." }, { status: 400 });

  let salaryMin, salaryMax, requiredSkills, preferredSkills;
  try {
    salaryMin = optionalNumber(source.salary_min, "salary_min");
    salaryMax = optionalNumber(source.salary_max, "salary_max");
    requiredSkills = stringList(source.required_skills, "required_skills");
    preferredSkills = stringList(source.preferred_skills, "preferred_skills");
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) {
    return NextResponse.json({ error: "salary_max cannot be less than salary_min." }, { status: 400 });
  }

  const authorization = await authorizeEmployer(request, companyId, organizationId);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://101.vercel.app").replace(/\/+$/, "");
  const payload = {
    event: "vacancy.submit",
    company_id: companyId,
    organization_id: organizationId,
    submitted_by: authorization.user.id,
    company_name: authorization.company.company_name,
    public_url: siteUrl + "/matches",
    job: {
      job_title: jobTitle,
      description,
      location: location || null,
      employment_type: employmentType,
      salary_min: salaryMin,
      salary_max: salaryMax,
      currency: typeof source.currency === "string" && /^[A-Z]{3}$/.test(source.currency) ? source.currency : "NGN",
      required_skills: requiredSkills,
      preferred_skills: preferredSkills,
      experience_min: 0,
      experience_max: null,
      education: []
    }
  };

  const sent = await postToN8n(process.env.WORKBRIDGE_N8N_VACANCY_INTAKE_WEBHOOK_URL, payload);
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });

  return NextResponse.json({ ok: true, queued: true, message: "Vacancy submitted to n8n for AI drafting." }, { status: 202 });
}
