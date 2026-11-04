export type OAuthProvider = "google" | "facebook";

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopes: string[];
}

export interface OAuthState {
  state: string;
  codeVerifier: string;
  provider: OAuthProvider;
  createdAt: number;
}

export interface ProviderTokens {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface ProviderProfile {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbIdentity {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  provider_user_id: string;
  created_at: string;
}

export interface SessionPayload {
  sub: string; // user id
  email: string;
  iat: number;
  exp: number;
}

export interface OAuthCallbackResult {
  user: DbUser;
  isNewUser: boolean;
  linkedIdentity: boolean;
}
