import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;
const NONCE_TTL_MINUTES = 10;

function failure(status, error) {
  return { ok: false, status, error };
}

/**
 * Verify a signed n8n callback.
 *
 * Signature format:
 *   x-workbridge-signature: v1=<hex HMAC-SHA256>
 * HMAC input:
 *   <unix-seconds>.<nonce>.<exact-raw-request-body>
 *
 * The nonce hash is inserted into a server-only table with a unique key so
 * replay detection remains atomic across serverless instances.
 */
export async function verifyN8nWebhookRequest(request) {
  const secret = process.env.WORKBRIDGE_N8N_INBOUND_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    return failure(503, "Inbound automation is not configured.");
  }

  const contentType = request.headers.get("content-type") || "";
  if (!/^application\\/json(?:\\s*;|$)/i.test(contentType)) {
    return failure(415, "Content-Type must be application/json.");
  }

  const timestampHeader = request.headers.get("x-workbridge-timestamp") || "";
  const nonce = request.headers.get("x-workbridge-nonce") || "";
  const signatureHeader = request.headers.get("x-workbridge-signature") || "";

  if (!/^\\d{10}$/.test(timestampHeader)) {
    return failure(401, "Invalid webhook authentication.");
  }
  if (!/^[A-Za-z0-9_-]{22,128}$/.test(nonce)) {
    return failure(401, "Invalid webhook authentication.");
  }
  const signatureMatch = /^v1=([a-f0-9]{64})$/i.exec(signatureHeader);
  if (!signatureMatch) {
    return failure(401, "Invalid webhook authentication.");
  }

  const timestamp = Number(timestampHeader);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return failure(401, "Webhook timestamp is outside the allowed window.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
    return failure(413, "Webhook payload is too large.");
  }

  let rawBody;
  try {
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.byteLength > MAX_BODY_BYTES) {
      return failure(413, "Webhook payload is too large.");
    }
    rawBody = bytes.toString("utf8");
  } catch {
    return failure(400, "A valid JSON payload is required.");
  }

  const signedContent = timestampHeader + "." + nonce + "." + rawBody;
  const expected = createHmac("sha256", secret).update(signedContent, "utf8").digest();
  const supplied = Buffer.from(signatureMatch[1], "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return failure(401, "Invalid webhook authentication.");
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return failure(400, "A valid JSON payload is required.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return failure(400, "A JSON object payload is required.");
  }

  const nonceHash = createHash("sha256").update(nonce, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + NONCE_TTL_MINUTES * 60_000).toISOString();

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return failure(503, "Inbound automation is temporarily unavailable.");
  }

  const { error: insertError } = await admin
    .from("n8n_webhook_nonces")
    .insert({ nonce_hash: nonceHash, expires_at: expiresAt });

  if (insertError) {
    if (insertError.code === "23505") {
      return failure(409, "Webhook request has already been processed.");
    }
    return failure(503, "Inbound automation is temporarily unavailable.");
  }

  // Opportunistic TTL cleanup. A cleanup failure must not invalidate a
  // successfully reserved nonce or cause the caller to retry a valid event.
  await admin
    .from("n8n_webhook_nonces")
    .delete()
    .lt("expires_at", new Date().toISOString());

  return { ok: true, payload };
}
