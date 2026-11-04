import type { OAuthProvider, ProviderTokens, ProviderProfile } from "@/types/oauth";
import { getProviderConfig } from "./config";

export function buildAuthorizationUrl(
  provider: OAuthProvider,
  redirectUri: string,
  state: string,
  codeChallenge: string
): string {
  const config = getProviderConfig(provider);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  if (provider === "facebook") {
    params.set("auth_type", "rerequest");
  }
  return `${config.authorizationEndpoint}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<ProviderTokens> {
  const config = getProviderConfig(provider);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

export async function fetchProviderProfile(
  provider: OAuthProvider,
  tokens: ProviderTokens
): Promise<ProviderProfile> {
  const config = getProviderConfig(provider);

  if (provider === "google") {
    const response = await fetch(config.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!response.ok) throw new Error("Failed to fetch Google profile");
    const data = await response.json();
    return {
      providerUserId: data.sub,
      email: data.email,
      emailVerified: data.email_verified === true,
      name: data.name || null,
      avatarUrl: data.picture || null,
    };
  }

  // Facebook
  const response = await fetch(`${config.userInfoEndpoint}&access_token=${encodeURIComponent(tokens.accessToken)}`);
  if (!response.ok) throw new Error("Failed to fetch Facebook profile");
  const data = await response.json();
  // Facebook picture
  let avatarUrl: string | null = null;
  if (data.picture && data.picture.data && data.picture.data.url) {
    avatarUrl = data.picture.data.url;
  }
  return {
    providerUserId: String(data.id),
    email: data.email,
    emailVerified: true, // Facebook does not provide email_verified; treat present email as verified
    name: data.name || null,
    avatarUrl,
  };
}
