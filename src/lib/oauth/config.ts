import type { OAuthProvider, ProviderConfig } from "@/types/oauth";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildConfig(provider: OAuthProvider): ProviderConfig {
  if (provider === "google") {
    return {
      clientId: requiredEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      userInfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
      scopes: ["openid", "email", "profile"],
    };
  }
  return {
    clientId: requiredEnv("FACEBOOK_CLIENT_ID"),
    clientSecret: requiredEnv("FACEBOOK_CLIENT_SECRET"),
    authorizationEndpoint: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenEndpoint: "https://graph.facebook.com/v18.0/oauth/access_token",
    userInfoEndpoint: "https://graph.facebook.com/me?fields=id,name,email,picture",
    scopes: ["email", "public_profile"],
  };
}

const cache: Partial<Record<OAuthProvider, ProviderConfig>> = {};

export function getProviderConfig(provider: string): ProviderConfig {
  if (provider !== "google" && provider !== "facebook") {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
  if (!cache[provider]) cache[provider] = buildConfig(provider);
  return cache[provider] as ProviderConfig;
}
