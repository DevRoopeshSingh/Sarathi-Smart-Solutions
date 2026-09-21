import { getAuth } from "@/server/auth";
import { AccessDeniedError, requireAdmin } from "@/server/dal";
import { jsonResponse, rejectUnsafeMutation } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;
  try {
    await requireAdmin(request.headers);
    await getAuth().api.revokeSessions({ headers: request.headers });
    // signOut clears the browser cookie even after all durable session rows are revoked.
    const response = await getAuth().api.signOut({ headers: request.headers, asResponse: true });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return error instanceof AccessDeniedError
      ? jsonResponse({ error: "Administrator access is required." }, 401)
      : jsonResponse({ error: "Session revocation is temporarily unavailable." }, 503);
  }
}
