import { readFile } from "node:fs/promises";
import path from "node:path";

// Serve the same standalone document as Cloudflare Pages, without the CCTV layout.
export async function GET() {
  const origin = new URL(
    process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "https://sarathismartsolutions.in"
  );
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  ) {
    throw new Error("The public site URL must be an HTTP(S) origin without a path or credentials.");
  }
  const template = await readFile(
    path.join(process.cwd(), "public", "digital-seva-kendra.html"),
    "utf8"
  );
  return new Response(template.replaceAll("__SITE_URL__", origin.origin), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }
  });
}
