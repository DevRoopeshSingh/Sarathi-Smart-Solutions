import { getAdminActor } from "@/server/dal";
import { jsonResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getAdminActor(request.headers);
    return actor
      ? jsonResponse({ actor })
      : jsonResponse({ error: "Administrator access is required." }, 401);
  } catch {
    return jsonResponse({ error: "Administrator access is temporarily unavailable." }, 503);
  }
}
