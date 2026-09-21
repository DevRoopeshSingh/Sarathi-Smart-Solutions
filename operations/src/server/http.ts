import "server-only";
import { readServerEnvironment } from "./env";

export class RequestBodyError extends Error {}

/** Bound bytes while streaming; Content-Length alone is not a trustworthy size limit. */
export async function readBoundedJson(request: Request, maxBytes = 4096): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError("A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError("Request body is too large.");
      }
      chunks.push(value);
    }
    const data = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Invalid JSON body.");
  } finally {
    reader.releaseLock();
  }
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...Object.fromEntries(new Headers(extraHeaders))
    }
  });
}

export function rejectUnsafeMutation(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const env = readServerEnvironment();
  if (
    !origin ||
    !env.trustedOrigins.includes(origin) ||
    (site !== null && site !== "same-origin" && site !== "none")
  ) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  ) {
    return jsonResponse({ error: "JSON content is required." }, 415);
  }
  return null;
}
