import crypto from "node:crypto";

function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("OAuth state signing is not configured. Set OAUTH_STATE_SECRET or AUTH_SECRET to a random value of at least 32 bytes.");
  }
  return secret;
}

export function signState(payload: string): string {
  const hmac = crypto.createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
  return `${payload}.${hmac}`;
}

export function verifyState(signed: string): string | null {
  try {
    if (typeof signed !== "string" || signed.length > 8192) return null;
    const idx = signed.lastIndexOf(".");
    if (idx === -1) return null;
    const payload = signed.slice(0, idx);
    const signature = signed.slice(idx + 1);
    const expected = crypto.createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
    const suppliedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
    return payload;
  } catch {
    return null;
  }
}
