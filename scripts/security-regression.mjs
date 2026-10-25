import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationPath = new URL("../supabase/migrations/20261025100000_harden_security_definer_search_path.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");

function functionBody(name) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `Missing function definition: ${name}`);
  const next = sql.indexOf("\ncreate or replace function public.", start + 1);
  return sql.slice(start, next === -1 ? sql.length : next);
}

const checks = [
  {
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
    name: "employer_create_job",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/auth\.uid\(\)\s+is\s+null/i, "must reject anonymous callers"],
      [/company_id\s*=\s*p_company_id[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i, "must scope job creation to the caller's company membership"],
    ],
  },
  {
    name: "get_employer_interviews",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/v_role\s*<>\s*'employer'/i, "must require the employer role"],
      [/public\.is_company_member\(j\.company_id\)/i, "must scope interview results to company membership"],
      [/jsonb_build_object\([\s\S]*?'first_name'[\s\S]*?'last_name'[\s\S]*?'location'[\s\S]*?'years_experience'/i, "must return only the explicit candidate summary fields"],
    ],
  },
  {
    name: "recruiter_schedule_interview",
    assertions: [
      [/security definer/i, "must remain SECURITY DEFINER"],
      [/set search_path\s*=\s*''/i, "must pin an empty search_path"],
      [/v_role\s+not\s+in\s*\('recruiter',\s*'admin'\)/i, "must restrict scheduling to recruiter/admin roles"],
      [/application_not_found/i, "must validate that the application exists"],
      [/insert into public\.audit_logs/i, "must audit interview scheduling"],
    ],
  },
];

let count = 0;
for (const check of checks) {
  const body = functionBody(check.name);
  for (const [pattern, message] of check.assertions) {
    assert.match(body, pattern, `${check.name} ${message}`);
    count += 1;
  }
  console.log(`PASS ${check.name}`);
}
console.log(`Security regression checks passed: ${count}`);
