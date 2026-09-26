import "server-only";
import { isIP } from "node:net";

/** Trust Vercel's edge header only inside its runtime, never arbitrary proxies. */
export function getClientIp(request: Request, source: NodeJS.ProcessEnv = process.env): string {
  if (source.VERCEL === "1") {
    // https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
    const value = request.headers.get("x-vercel-forwarded-for")?.trim();
    if (!value || !isIP(value)) throw new Error("Trusted client address is unavailable.");
    // Canonicalize IPv6 so equivalent spellings cannot create separate quotas.
    return isIP(value) === 6 ? new URL(`http://[${value}]/`).hostname.slice(1, -1) : value;
  }

  // Support local dev and production-build tests using server-owned configuration.
  // Request Host/URL and client forwarding headers cannot enable this fallback.
  const origin = new URL(source.BETTER_AUTH_URL ?? "");
  if (["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) return "127.0.0.1";
  throw new Error("A trusted client-address provider is required.");
}

export function authRequestHeaders(input: Headers, clientIp: string): Headers {
  const headers = new Headers(input);
  headers.delete("content-length");
  headers.delete("x-forwarded-for");
  headers.delete("x-vercel-forwarded-for");
  headers.delete("x-real-ip");
  headers.delete("forwarded");
  headers.set("x-sarathi-auth-client-ip", clientIp);
  return headers;
}
