import { NextResponse } from "next/server";
import { getSamlConfig, buildAuthnRequest } from "../../../../../lib/saml";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const config = getSamlConfig(origin);
  if (!config.idpSsoUrl) {
    return NextResponse.redirect(new URL("/login?error=saml_not_configured", origin));
  }
  const samlRequest = buildAuthnRequest(config);
  const form = `<!DOCTYPE html><html><body onload="document.forms[0].submit()">
    <form method="POST" action="${config.idpSsoUrl}">
      <input type="hidden" name="SAMLRequest" value="${samlRequest}" />
      <input type="hidden" name="RelayState" value="${origin}/dashboard" />
      <noscript><button type="submit">Continue</button></noscript>
    </form>
  </body></html>`;
  return new NextResponse(form, { headers: { "Content-Type": "text/html" } });
}
