import { AccessDeniedError } from "@/server/dal";
import { jsonResponse, rejectUnsafeMutation } from "@/server/http";
import { completeOnboarding } from "@/server/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const rejected = rejectUnsafeMutation(request);
    if (rejected) return rejected;
    // No user ID or preferences are accepted from the caller.
    await completeOnboarding(request.headers);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { error: "Unable to save your introduction preference. Please try again." },
      error instanceof AccessDeniedError ? 401 : 503
    );
  }
}
