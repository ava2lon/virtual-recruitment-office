import crypto from "node:crypto";
import type { SessionPayload } from "@/types/oauth";

const SESSION_COOKIE = "wb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CLOCK_SKEW_SECONDS = 60;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Session signing is not configured. Set SESSION_SECRET or AUTH_SECRET to a random value of at least 32 bytes.");
  }
  return secret;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function issueSessionToken(userId: string, email: string): string {
  if (!userId || !email) throw new Error("A user ID and email are required to issue a session.");
  const secret = getSessionSecret();
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
  const signature = crypto.createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    if (typeof token !== "string" || token.length > 8192) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const secret = getSessionSecret();
    const expected = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
    if (!safeEqual(signature, expected)) return null;

    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    if (header?.alg !== "HS256" || header?.typ !== "JWT") return null;

    const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof decoded.sub !== "string" || !decoded.sub ||
      typeof decoded.email !== "string" || !decoded.email ||
      typeof decoded.iat !== "number" || !Number.isFinite(decoded.iat) ||
      typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp) ||
      decoded.iat > now + CLOCK_SKEW_SECONDS ||
      decoded.exp <= now ||
      decoded.exp <= decoded.iat ||
      decoded.exp - decoded.iat > SESSION_TTL_SECONDS
    ) return null;

    return decoded as SessionPayload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(SESSION_COOKIE + "="));
  if (!cookie) return null;
  try {
    const token = decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=0`;
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
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `${REFRESH_COOKIE}=; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=0`;
}

export { REFRESH_COOKIE, REFRESH_TTL_SECONDS };
