import { getCustomerOptions, AccessDeniedError } from "@/server/dal";
import { jsonResponse } from "@/server/http";
import { InputError } from "@/server/input";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return jsonResponse({
      options: await getCustomerOptions(
        request.headers,
        new URL(request.url).searchParams.get("q") ?? ""
      )
    });
  } catch (error) {
    return jsonResponse(
      { error: "Customer search is unavailable." },
      error instanceof AccessDeniedError ? 401 : error instanceof InputError ? 400 : 503
    );
  }
}
