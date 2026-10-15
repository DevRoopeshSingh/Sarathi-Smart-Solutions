import { requireOrganizationPermission } from "@/server/tenancy";
import { AccessDeniedError, InputError } from "@/server/mutation-errors";
import { jsonResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    // Submitted IDs are selectors, never proof of membership or division access.
    const context = await requireOrganizationPermission(
      request.headers,
      params.get("organizationId") ?? "",
      "dashboard.read",
      params.get("divisionId") ?? undefined
    );
    return jsonResponse({ context });
  } catch (error) {
    if (error instanceof AccessDeniedError)
      return jsonResponse({ error: "Organization access is required." }, 403);
    if (error instanceof InputError)
      return jsonResponse({ error: "Choose valid organization and division IDs." }, 400);
    return jsonResponse({ error: "Organization access is temporarily unavailable." }, 503);
  }
}
