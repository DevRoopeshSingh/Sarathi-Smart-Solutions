import { getAuth } from "@/server/auth";
import { requireAdmin, AccessDeniedError } from "@/server/dal";
import {
  readBoundedJson,
  rejectUnsafeMutation,
  jsonResponse,
  RequestBodyError
} from "@/server/http";
import { consumeRateLimit } from "@/server/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rejected = rejectUnsafeMutation(request);
    if (rejected) return rejected;
    const actor = await requireAdmin(request.headers);
    const limit = await consumeRateLimit(`security:${actor.id}`, { window: 300, max: 10 });
    if (!limit.allowed)
      return jsonResponse({ error: "Please wait before trying again." }, 429, {
        "Retry-After": String(limit.retryAfter)
      });
    const body = await readBoundedJson(request);
    if (
      !body ||
      typeof body !== "object" ||
      !("action" in body) ||
      !("password" in body) ||
      typeof body.password !== "string" ||
      !body.password ||
      body.password.length > 128
    ) {
      return jsonResponse({ error: "A password is required." }, 400);
    }
    const args = {
      headers: request.headers,
      body: { password: body.password },
      asResponse: true as const
    };
    let response: Response;
    switch (body.action) {
      case "enable":
        response = await getAuth().api.enableTwoFactor({
          ...args,
          body: { password: body.password, method: "totp" }
        });
        break;
      case "disable":
        response = await getAuth().api.disableTwoFactor(args);
        break;
      case "backup-codes":
        response = await getAuth().api.generateBackupCodes(args);
        break;
      default:
        return jsonResponse({ error: "Unknown security action." }, 400);
    }
    if (!response.ok)
      return jsonResponse(
        { error: "Unable to update security settings. Check your password and try again." },
        400
      );
    const data = await response.json();
    const result = jsonResponse(
      body.action === "enable"
        ? { totpURI: data.totpURI, backupCodes: data.backupCodes }
        : body.action === "backup-codes"
          ? { backupCodes: data.backupCodes }
          : { ok: true }
    );
    for (const cookie of response.headers.getSetCookie())
      result.headers.append("Set-Cookie", cookie);
    return result;
  } catch (error) {
    return jsonResponse(
      { error: "Unable to update security settings." },
      error instanceof AccessDeniedError ? 401 : error instanceof RequestBodyError ? 400 : 503
    );
  }
}
