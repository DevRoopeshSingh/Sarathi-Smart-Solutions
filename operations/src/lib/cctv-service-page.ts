import fs from "node:fs/promises";
import path from "node:path";
import { publicSiteUrl } from "./public-site";

export async function cctvServicePage(filename: string): Promise<Response> {
  const template = await fs.readFile(path.join(process.cwd(), "public", filename), "utf8");
  return new Response(template.replaceAll("__SITE_URL__", publicSiteUrl()), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate"
    }
  });
}
