import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSamlClient, getSamlConfig } from "../../../../../lib/saml";
import { getSupabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { issueSessionToken, sessionCookieHeader } from "../../../../../lib/oauth/session";

export const runtime = "nodejs";

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") || "";
  const entry = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(name + "="));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length + 1)); }
  catch { return null; }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const stateCookie = readCookie(request, "wb_saml_state");
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1024 * 1024) {
    return NextResponse.redirect(new URL("/login?error=saml_response_too_large", origin));
  }

  const formData = await request.formData().catch(() => null);
  const samlResponse = formData?.get("SAMLResponse");
  const relayState = formData?.get("RelayState");
  if (typeof samlResponse !== "string" || !samlResponse || typeof relayState !== "string" ||
      !stateCookie || !safeEqual(stateCookie, relayState)) {
    const response = NextResponse.redirect(new URL("/login?error=invalid_saml_state", origin));
    response.cookies.set("wb_saml_state", "", { path: "/api/auth/saml/acs", maxAge: 0 });
    return response;
  }

  const config = getSamlConfig(origin);
  if (!config.idpSsoUrl || !config.idpCert || !config.idpEntityId) {
    return NextResponse.redirect(new URL("/login?error=saml_not_configured", origin));
  }

  let profile;
  try {
    const saml = createSamlClient(origin);
    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    profile = result.profile;
    if (!profile || profile.issuer !== config.idpEntityId) {
      throw new Error("SAML identity provider issuer mismatch");
    }
  } catch {
    const response = NextResponse.redirect(new URL("/login?error=saml_validation_failed", origin));
    response.cookies.set("wb_saml_state", "", { path: "/api/auth/saml/acs", maxAge: 0 });
    return response;
  }

  const rawEmail = profile.email || profile.mail || profile.nameID || "";
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const response = NextResponse.redirect(new URL("/login?error=saml_no_valid_email", origin));
    response.cookies.set("wb_saml_state", "", { path: "/api/auth/saml/acs", maxAge: 0 });
    return response;
  }

  let supabase;
  try { supabase = getSupabaseAdmin(); }
  catch {
    return NextResponse.redirect(new URL("/login?error=authentication_unavailable", origin));
  }

  const { data: existing, error: lookupError } = await supabase.from("users")
    .select("id,email").eq("email", email).maybeSingle();
  if (lookupError) return NextResponse.redirect(new URL("/login?error=authentication_unavailable", origin));

  let user = existing;
  if (!user) {
    const displayName = typeof profile.displayName === "string" ? profile.displayName.slice(0, 120) : email;
    const { data: newUser, error } = await supabase.from("users")
      .insert({ email, name: displayName, email_verified: true })
      .select("id,email").single();
    if (error || !newUser) {
      return NextResponse.redirect(new URL("/login?error=user_creation_failed", origin));
    }
    user = newUser;
  } else {
    const { error } = await supabase.from("users").update({ email_verified: true }).eq("id", user.id);
    if (error) return NextResponse.redirect(new URL("/login?error=authentication_unavailable", origin));
  }

  const token = issueSessionToken(user.id, user.email);
  const response = NextResponse.redirect(new URL("/dashboard", origin));
  response.headers.set("Set-Cookie", sessionCookieHeader(token));
  response.cookies.set("wb_saml_state", "", { path: "/api/auth/saml/acs", maxAge: 0 });
  return response;
}
