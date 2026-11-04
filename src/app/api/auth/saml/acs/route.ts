import { NextResponse } from "next/server";
import { getSamlConfig, parseSamlResponse } from "../../../../../lib/saml";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { issueSessionToken, sessionCookieHeader } from "../../../../../lib/oauth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const formData = await request.formData();
  const samlResponse = formData.get("SAMLResponse");
  if (typeof samlResponse !== "string" || !samlResponse) {
    return NextResponse.redirect(new URL("/login?error=missing_saml_response", origin));
  }

  const config = getSamlConfig(origin);
  if (!config.idpEntityId) {
    return NextResponse.redirect(new URL("/login?error=saml_not_configured", origin));
  }

  let assertion;
  try {
    assertion = parseSamlResponse(samlResponse);
  } catch {
    return NextResponse.redirect(new URL("/login?error=saml_parse_failed", origin));
  }
  if (!assertion.email) {
    return NextResponse.redirect(new URL("/login?error=saml_no_email", origin));
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("users").select("*").eq("email", assertion.email).maybeSingle();

  let user = existing;
  if (!user) {
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({ email: assertion.email, name: assertion.attributes["displayName"] || assertion.nameId, email_verified: true })
      .select("*")
      .single();
    if (error || !newUser) {
      return NextResponse.redirect(new URL("/login?error=user_creation_failed", origin));
    }
    user = newUser;
  }

  const token = issueSessionToken(user.id, user.email);
  const response = NextResponse.redirect(new URL("/dashboard", origin));
  response.headers.set("Set-Cookie", sessionCookieHeader(token));
  return response;
}
