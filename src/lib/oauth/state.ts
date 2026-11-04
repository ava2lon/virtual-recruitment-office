import crypto from "node:crypto";

const STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.AUTH_SECRET || "dev-state-secret-change-me";

export function signState(payload: string): string {
  const hmac = crypto.createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
  return `${payload}.${hmac}`;
}

export function verifyState(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const payload = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return payload;
}
