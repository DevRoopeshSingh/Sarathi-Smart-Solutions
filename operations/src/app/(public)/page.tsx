import fs from "node:fs";
import path from "node:path";
import Script from "next/script";

export default function HomePage() {
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://sarathi-smart-solutions.pages.dev";
  const htmlPath = path.join(process.cwd(), "public", "index.html");
  let content = fs.readFileSync(htmlPath, "utf8");
  content = content.replaceAll("__SITE_URL__", siteUrl);

  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(content);
  const rawBody = bodyMatch ? bodyMatch[1] : content;

  // Strip the static script tag so we can manage it cleanly with Next.js Script component
  const sanitizedBody = rawBody.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: sanitizedBody }} />
      <Script src="/app.js" type="module" strategy="afterInteractive" />
    </>
  );
}
