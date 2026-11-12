import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Consume one request from a shared, database-backed fixed-window bucket.
 * The database UPSERT is atomic across concurrent/serverless instances.
 * Storage errors are thrown so callers can fail closed instead of silently
 * reverting to a per-instance in-memory limiter.
 */
export async function consumeRateLimit(bucketKey, { limit = 30, windowSeconds = 60 } = {}) {
  if (typeof bucketKey !== "string" || !bucketKey || bucketKey.length > 128) {
    throw new TypeError("A valid rate-limit bucket key is required.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100000 ||
      !Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400) {
    throw new RangeError("Invalid rate-limit configuration.");
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("Shared rate-limit storage is unavailable.");

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.allowed !== "boolean" || !result.reset_at) {
    throw new Error("Shared rate-limit storage returned an invalid result.");
  }

  return {
    allowed: result.allowed,
    remaining: Number(result.remaining),
    resetAt: result.reset_at,
  };
}
