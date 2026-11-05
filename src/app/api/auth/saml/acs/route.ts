import { NextResponse } from "next/server";
import { SAML } from "@node-saml/node-saml";
import { getSamlConfig } from "../../../../../lib/saml";
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
  if (!config.idpSsoUrl || !config.idpCert) {
    return NextResponse.redirect(new URL("/login?error=saml_not_configured", origin));
  }

  const saml = new SAML({
    callbackUrl: config.spAcsUrl,
    entryPoint: config.idpSsoUrl,
    issuer: config.spEntityId,
    idpCert: config.idpCert,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
  });

  let profile: { nameID?: string; email?: string; [key: string]: unknown };
  try {
    const { profile: p } = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    profile = p as { nameID?: string; email?: string; [key: string]: unknown };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "saml_validation_failed";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, origin));
  }

  const email = (profile.email as string) || (profile.nameID as string) || "";
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=saml_no_email", origin));
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("users").select("*").eq("email", email).maybeSingle();

  let user = existing;
  if (!user) {
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({ email, name: (profile.nameID as string) || email, email_verified: true })
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
