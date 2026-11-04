import crypto from "node:crypto";
import type { SessionPayload } from "@/types/oauth";

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.AUTH_SECRET || "dev-session-secret-change-me";
const SESSION_COOKIE = "wb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function issueSessionToken(userId: string, email: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: userId,
    email,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${header}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(`${header}.${payload}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

export { SESSION_COOKIE };

// --- Refresh token helpers ---
const REFRESH_COOKIE = "wb_refresh";
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function issueRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `${REFRESH_COOKIE}=${token}; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=${REFRESH_TTL_SECONDS}`;
}

export function clearRefreshCookieHeader(): string {
  return `${REFRESH_COOKIE}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`;
}

export { REFRESH_COOKIE, REFRESH_TTL_SECONDS };
