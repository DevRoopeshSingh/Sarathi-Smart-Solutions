import { getAuth } from "@/server/auth";
import { AccessDeniedError, requireAdmin } from "@/server/dal";
import { getPool } from "@/server/db";
import { jsonResponse, rejectUnsafeMutation } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rejected = rejectUnsafeMutation(request);
    if (rejected) return rejected;
    const actor = await requireAdmin(request.headers);
    // A password-validated MFA challenge can create a session later; revoke it too.
    await getPool().query(
      `DELETE FROM sarathi.auth_verifications WHERE value =
      (SELECT identity_subject FROM sarathi.users WHERE id=$1) OR identifier IN
      (SELECT '2fa-attempts-' || identifier FROM sarathi.auth_verifications WHERE value =
        (SELECT identity_subject FROM sarathi.users WHERE id=$1))`,
      [actor.id]
    );
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
