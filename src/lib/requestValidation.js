export const MAX_JSON_BODY_BYTES = 16 * 1024;

export async function readJsonObject(request, maxBytes = MAX_JSON_BODY_BYTES) {
  const contentType = request.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { ok: false, status: 415, error: "Content-Type must be application/json." };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    return { ok: false, status: 413, error: "Request payload is too large." };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400, error: "A valid JSON object is required." };

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "Request payload is too large." };
      }
      chunks.push(Buffer.from(value));
    }

    const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, totalBytes));
    const payload = JSON.parse(rawBody);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, status: 400, error: "A JSON object payload is required." };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, status: 400, error: "A valid JSON object is required." };
  }
}
