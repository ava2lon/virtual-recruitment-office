import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationFiles = {
  hardened: "../supabase/migrations/20261025100000_harden_security_definer_search_path.sql",
  tenantScope: "../supabase/migrations/20261025110000_scope_interview_scheduling_to_company.sql",
  interviewPrivacy: "../supabase/migrations/20261025120000_limit_employer_interview_response_fields.sql",
};
const migrations = Object.fromEntries(
  Object.entries(migrationFiles).map(([key, path]) => [
    key,
    readFileSync(new URL(path, import.meta.url), "utf8"),
  ]),
);

function functionBody(sourceName, functionName) {
  const source = migrations[sourceName];
  assert.ok(source, "Missing migration source: " + sourceName);
  const start = source.indexOf("create or replace function public." + functionName + "(");
  assert.notEqual(start, -1, "Missing function definition: " + functionName + " in " + sourceName);
  const next = source.indexOf("\ncreate or replace function public.", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

const checks = [
  {
    source: "hardened",
    name: "employer_create_company",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/auth\.uid\(\)\s+is\s+null/i, "must reject anonymous callers"],
      [/role\s*=\s*'employer'/i, "must require the employer role"],
      [/insert into public\.company_members/i, "must create owner membership for the company"],
    ],
  },
  {
    source: "hardened",
    name: "employer_create_job",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/auth\.uid\(\)\s+is\s+null/i, "must reject anonymous callers"],
      [/company_id\s*=\s*p_company_id[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i, "must scope job creation to the caller's company membership"],
    ],
  },
  {
    source: "interviewPrivacy",
    name: "get_employer_interviews",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/v_role\s*<>\s*'employer'/i, "must require the employer role"],
      [/public\.is_company_member\(j\.company_id\)/i, "must scope interview results to company membership"],
      [/'application'[\s\S]*?'job'[\s\S]*?'candidate'/i, "must construct explicit nested response objects"],
      [/'first_name'[\s\S]*?'last_name'[\s\S]*?'location'[\s\S]*?'years_experience'/i, "must return approved candidate summary fields"],
    ],
    forbidden: [
      [/to_jsonb\(i\)|to_jsonb\(a\)|to_jsonb\(j\)/i, "must not serialize complete interview, application, or job rows"],
      [/'recruiter_notes'/i, "must not expose recruiter notes"],
      [/'ai_screening'/i, "must not expose AI screening payloads"],
      [/'match_score'/i, "must not expose matching scores"],
      [/'screening_score'/i, "must not expose screening scores"],
      [/'recruiter_score'/i, "must not expose recruiter scores"],
    ],
  },
  {
    source: "tenantScope",
    name: "recruiter_schedule_interview",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/v_role\s+not\s+in\s*\('recruiter',\s*'admin'\)/i, "must restrict scheduling to recruiter/admin roles"],
      [/application_not_found/i, "must validate that the application exists"],
      [/join public\.company_members cm on cm\.company_id = j\.company_id/i, "must resolve company membership through the application's job"],
      [/cm\.user_id = v_user/i, "must require the caller to belong to that company"],
      [/if v_role <> 'admin' and not exists/i, "must restrict cross-company scheduling for non-admins"],
      [/insert into public\.interviews/i, "must create the interview only after authorization checks"],
      [/update public\.applications[\s\S]*?where id = p_application_id/i, "must update the application linked to the authorized interview"],
      [/insert into public\.audit_logs/i, "must audit interview scheduling"],
      [/jsonb_build_object\([\\s\\S]*?'application_id'[\\s\\S]*?'scheduled_at'/i, "must record the application and schedule in audit metadata"],
    ],
  },
];

let count = 0;
for (const check of checks) {
  const body = functionBody(check.source, check.name);
  for (const [pattern, message] of check.assertions) {
    assert.match(body, pattern, check.name + " " + message);
    count += 1;
  }
  for (const [pattern, message] of check.forbidden || []) {
    assert.doesNotMatch(body, pattern, check.name + " " + message);
    count += 1;
  }
  console.log("PASS " + check.name);
}
console.log("Security regression checks passed: " + count);
