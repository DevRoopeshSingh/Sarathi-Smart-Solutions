import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";
import {
  jsonResponse,
  rejectUnsafeMutation,
  readBoundedJson,
  RequestBodyError
} from "@/server/http";
import { consumeRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const path = new URL(request.url).pathname;
  if (path !== "/api/auth/sign-in/email" && path !== "/api/auth/sign-out") {
    return jsonResponse({ error: "Not found." }, 404);
  }
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;
  try {
    const global = await consumeRateLimit(`http:${path}`, {
      window: 60,
      max: path.endsWith("/sign-in/email") ? 30 : 100
    });
    if (!global.allowed)
      return jsonResponse({ error: "Too many attempts. Try again later." }, 429, {
        "Retry-After": String(global.retryAfter)
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
    } else {
      // Logout takes no caller-supplied fields; never pass an unbounded request body
      // into the library parser.
      request = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: "{}"
      });
    }
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.set("x-sarathi-auth-client-ip", "127.0.0.1");
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");
    const forwarded = new Request(request, { headers });
    const response = await toNextJsHandler(getAuth()).POST(forwarded);
    if (
      !response.ok &&
      path.endsWith("/sign-in/email") &&
      response.status !== 429 &&
      response.status < 500
    ) {
      return jsonResponse({ error: "Invalid email or password." }, 401);
    }
    if (response.ok && path.endsWith("/sign-in/email")) {
      const result = jsonResponse({ ok: true });
      // Session tokens remain solely in HttpOnly cookies; never serialize library auth records.
      for (const cookie of response.headers.getSetCookie())
        result.headers.append("Set-Cookie", cookie);
      return result;
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return jsonResponse({ error: "Sign-in service is temporarily unavailable." }, 503);
  }
}

export function GET() {
  return jsonResponse({ error: "Not found." }, 404);
}
