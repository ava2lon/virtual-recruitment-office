import { SAML, ValidateInResponseTo } from "@node-saml/node-saml";
import { getSupabaseAdmin } from "./supabaseAdmin";

export interface SamlConfig {
  spEntityId: string;
  spAcsUrl: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCert: string;
}

const REQUEST_TTL_MS = 5 * 60 * 1000;

export function getSamlConfig(baseUrl: string): SamlConfig {
  return {
    spEntityId: process.env.SAML_SP_ENTITY_ID || `${baseUrl}/api/auth/saml/metadata`,
    spAcsUrl: `${baseUrl}/api/auth/saml/acs`,
    idpEntityId: process.env.SAML_IDP_ENTITY_ID || "",
    idpSsoUrl: process.env.SAML_IDP_SSO_URL || "",
    idpCert: process.env.SAML_IDP_CERT || "",
  };
}

function createDatabaseCacheProvider() {
  const admin = getSupabaseAdmin();
  return {
    async saveAsync(key: string, value: string) {
      const createdAt = Date.now();
      const { error } = await admin.from("saml_request_cache").insert({
        request_id: key,
        cache_value: value,
        created_at_ms: createdAt,
        expires_at: new Date(createdAt + REQUEST_TTL_MS).toISOString(),
      });
      if (error) return null;
      return { value, createdAt };
    },
    async getAsync(key: string) {
      const { data, error } = await admin.from("saml_request_cache")
        .select("cache_value").eq("request_id", key)
        .gt("expires_at", new Date().toISOString()).maybeSingle();
      return error || !data ? null : data.cache_value;
    },
    async removeAsync(key: string | null) {
      if (!key) return null;
      const { data, error } = await admin.from("saml_request_cache")
        .delete().eq("request_id", key).select("cache_value").maybeSingle();
      return error || !data ? null : data.cache_value;
    },
    async consumeAsync(key: string) {
      const { data, error } = await admin.from("saml_request_cache")
        .delete().eq("request_id", key).select("cache_value").maybeSingle();
      return error || !data ? null : data.cache_value;
    },
  };
}

export function createSamlClient(baseUrl: string) {
  const config = getSamlConfig(baseUrl);
  if (!config.idpSsoUrl || !config.idpCert || !config.idpEntityId) {
    throw new Error("SAML identity provider is not fully configured.");
  }
  return new SAML({
    callbackUrl: config.spAcsUrl,
    entryPoint: config.idpSsoUrl,
    issuer: config.spEntityId,
    audience: config.spEntityId,
    idpIssuer: config.idpEntityId,
    idpCert: config.idpCert,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: REQUEST_TTL_MS,
    maxAssertionAgeMs: REQUEST_TTL_MS,
    cacheProvider: createDatabaseCacheProvider(),
  });
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
