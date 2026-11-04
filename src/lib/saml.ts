export interface SamlConfig {
  spEntityId: string;
  spAcsUrl: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCert: string;
}

export function getSamlConfig(baseUrl: string): SamlConfig {
  return {
    spEntityId: process.env.SAML_SP_ENTITY_ID || `${baseUrl}/api/auth/saml/metadata`,
    spAcsUrl: `${baseUrl}/api/auth/saml/acs`,
    idpEntityId: process.env.SAML_IDP_ENTITY_ID || "",
    idpSsoUrl: process.env.SAML_IDP_SSO_URL || "",
    idpCert: process.env.SAML_IDP_CERT || "",
  };
}

export function buildSpMetadata(config: SamlConfig): string {
  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${config.spEntityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${config.spAcsUrl}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

export function buildAuthnRequest(config: SamlConfig): string {
  const id = "_" + Math.random().toString(36).slice(2);
  const issueInstant = new Date().toISOString();
  const xml = `<?xml version="1.0"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" IssueInstant="${issueInstant}" Destination="${config.idpSsoUrl}" AssertionConsumerServiceURL="${config.spAcsUrl}">
  <saml:Issuer>${config.spEntityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`;
  return Buffer.from(xml).toString("base64");
}

export interface SamlAssertion {
  nameId: string;
  email: string;
  attributes: Record<string, string>;
}

export function parseSamlResponse(base64Response: string): SamlAssertion {
  const xml = Buffer.from(base64Response, "base64").toString("utf8");
  // Extract NameID
  const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/) || xml.match(/<NameID[^>]*>([^<]+)<\/NameID>/);
  const nameId = nameIdMatch ? nameIdMatch[1].trim() : "";
  // Extract email attribute or use nameId
  const emailAttrMatch = xml.match(/AttributeName="[^"]*email[^"]*"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/i);
  const email = emailAttrMatch ? emailAttrMatch[1].trim() : nameId;
  // Generic attributes
  const attributes: Record<string, string> = {};
  const attrRegex = /AttributeName="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(xml)) !== null) {
    attributes[m[1]] = m[2].trim();
  }
  return { nameId, email, attributes };
}
