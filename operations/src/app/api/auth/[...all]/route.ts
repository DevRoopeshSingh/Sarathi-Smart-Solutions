import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";
import {
  jsonResponse,
  rejectUnsafeMutation,
  readBoundedJson,
  RequestBodyError
} from "@/server/http";
import { getClientIp, authRequestHeaders } from "@/server/client-ip";
import { consumeRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const path = new URL(request.url).pathname;
  const isVerification = [
    "/api/auth/two-factor/verify-totp",
    "/api/auth/two-factor/verify-backup-code"
  ].includes(path);
  if (path !== "/api/auth/sign-in/email" && path !== "/api/auth/sign-out" && !isVerification) {
    return jsonResponse({ error: "Not found." }, 404);
  }
  try {
    const rejected = rejectUnsafeMutation(request);
    if (rejected) return rejected;
    const clientIp = getClientIp(request);
    const client = await consumeRateLimit(`http:${path}:${clientIp}`, {
      window: 60,
      max: isVerification ? 10 : path.endsWith("/sign-in/email") ? 30 : 100
    });
    if (!client.allowed)
      return jsonResponse({ error: "Too many attempts. Try again later." }, 429, {
        "Retry-After": String(client.retryAfter)
      });
    if (path.endsWith("/sign-in/email")) {
      let body: unknown;
      try {
        body = await readBoundedJson(request);
      } catch (error) {
        if (error instanceof RequestBodyError)
          return jsonResponse({ error: "Invalid sign-in request." }, 400);
        throw error;
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("email" in body) ||
        typeof body.email !== "string" ||
        body.email.length > 254 ||
        !("password" in body) ||
        typeof body.password !== "string" ||
        body.password.length > 128
      ) {
        return jsonResponse({ error: "Invalid email or password." }, 401);
      }
      const email = body.email.trim().toLowerCase();
      const account = await consumeRateLimit(`login-email:${email}`, { window: 300, max: 5 });
      if (!account.allowed)
        return jsonResponse({ error: "Too many attempts. Try again later." }, 429, {
          "Retry-After": String(account.retryAfter)
        });
      // Allowlist request fields: do not accept arbitrary callbacks or session options.
      request = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ email, password: body.password })
      });
    } else if (isVerification) {
      const body = await readBoundedJson(request);
      if (
        !body ||
        typeof body !== "object" ||
        !("code" in body) ||
        typeof body.code !== "string" ||
        !body.code ||
        body.code.length > 64 ||
        (path.endsWith("verify-totp") && !/^\d{6}$/.test(body.code))
      ) {
        return jsonResponse({ error: "Invalid verification code." }, 400);
      }
      request = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ code: body.code, trustDevice: false })
      });
    } else {
      // Logout takes no caller-supplied fields; never pass an unbounded request body
      // into the library parser.
      request = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: "{}"
      });
    }
    const headers = authRequestHeaders(request.headers, clientIp);
    const forwarded = new Request(request, { headers });
    const response = await toNextJsHandler(getAuth()).POST(forwarded);
    if (
      !response.ok &&
      (path.endsWith("/sign-in/email") || isVerification) &&
      response.status !== 429 &&
      response.status < 500
    ) {
      const result = jsonResponse(
        {
          error: isVerification
            ? "Invalid or expired verification code."
            : "Invalid email or password."
        },
        401
      );
      for (const cookie of response.headers.getSetCookie())
        result.headers.append("Set-Cookie", cookie);
      return result;
    }
    if (response.ok && (path.endsWith("/sign-in/email") || isVerification)) {
      const body: unknown = await response.json();
      const twoFactorRequired =
        !!body &&
        typeof body === "object" &&
        "twoFactorRedirect" in body &&
        body.twoFactorRedirect === true;
      const result = jsonResponse(twoFactorRequired ? { twoFactorRequired: true } : { ok: true });
      // Session tokens remain solely in HttpOnly cookies; never serialize library auth records.
      for (const cookie of response.headers.getSetCookie())
        result.headers.append("Set-Cookie", cookie);
      return result;
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof RequestBodyError)
      return jsonResponse({ error: "Invalid request body." }, 400);
    return jsonResponse({ error: "Sign-in service is temporarily unavailable." }, 503);
  }
}

export function GET() {
  return jsonResponse({ error: "Not found." }, 404);
}
