import { paymentPdf } from "@/server/payments";
import { AccessDeniedError, InputError, mutationFailure } from "@/server/mutation-errors";
import { jsonResponse } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const document = await paymentPdf(request.headers, (await params).id);
    if (!document) return jsonResponse({ error: "Document unavailable." }, 404);
    return new Response(new Uint8Array(document.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="' + document.number.replace(/[^A-Za-z0-9_-]/g, "-") + '.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  } catch (error) {
    if (error instanceof AccessDeniedError)
      return jsonResponse({ error: "Staff sign-in and payment access are required." }, 403);
    if (error instanceof InputError) return jsonResponse({ error: "Document unavailable." }, 404);
    return jsonResponse(mutationFailure(error), 500);
  }
}
