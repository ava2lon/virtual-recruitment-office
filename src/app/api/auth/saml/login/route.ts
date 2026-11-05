import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSamlClient, getSamlConfig } from "../../../../../lib/saml";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const config = getSamlConfig(origin);
  if (!config.idpSsoUrl || !config.idpCert || !config.idpEntityId) {
    return NextResponse.redirect(new URL("/login?error=saml_not_configured", origin));
  }

  try {
    const relayState = crypto.randomBytes(32).toString("base64url");
    const saml = createSamlClient(origin);
    const form = await saml.getAuthorizeFormAsync(relayState);
    const response = new NextResponse(form, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; form-action https:; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
    response.cookies.set("wb_saml_state", relayState, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/api/auth/saml/acs",
      maxAge: 300,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=saml_start_failed", origin));
  }
}
