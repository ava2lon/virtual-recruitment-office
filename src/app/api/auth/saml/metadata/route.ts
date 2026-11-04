import { NextResponse } from "next/server";
import { getSamlConfig, buildSpMetadata } from "../../../../../lib/saml";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const config = getSamlConfig(origin);
  const xml = buildSpMetadata(config);
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
}
