import { createClient } from "@supabase/supabase-js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export async function authorizeEmployer(request, companyId, organizationId = null) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "Authentication required." };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { ok: false, status: 503, error: "Supabase is not configured." };

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + token } }
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return { ok: false, status: 401, error: "Your session is invalid or expired." };

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id,role")
    .eq("company_id", companyId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (membershipError) return { ok: false, status: 503, error: "Could not verify employer access." };
  if (!membership) return { ok: false, status: 403, error: "You do not have access to this company." };

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id,company_name")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError || !company) return { ok: false, status: 403, error: "The employer workspace could not be verified." };

  if (organizationId) {
    const { data: organizationMembership, error: organizationError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (organizationError) return { ok: false, status: 503, error: "Could not verify organization access." };
    if (!organizationMembership) return { ok: false, status: 403, error: "You do not have access to this organization." };
  }

  return { ok: true, supabase, user: authData.user, company };
}

export async function postToN8n(webhookUrl, payload) {
  if (!webhookUrl) return { ok: false, status: 503, error: "The n8n vacancy webhook is not configured." };

  let parsedUrl;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return { ok: false, status: 503, error: "The n8n vacancy webhook URL is invalid." };
  }
  if (parsedUrl.protocol !== "https:") {
    return { ok: false, status: 503, error: "The n8n vacancy webhook must use HTTPS." };
  }

  try {
    const response = await fetch(parsedUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, status: 502, error: "The n8n workflow did not accept the request." };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 502, error: "The n8n workflow could not be reached." };
  }
}
