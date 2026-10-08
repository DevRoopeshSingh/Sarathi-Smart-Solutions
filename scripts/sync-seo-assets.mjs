/** Keep public pages, their runtime assets and native crawl data in operations. */
import { copyFile, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES } from "./site-config.mjs";

const files = PUBLIC_FILES.filter(
  (file) =>
    file === "index.html" ||
    file === "styles.css" ||
    file === "app.js" ||
    file === "locator.js" ||
    file === "recommendation.mjs" ||
    file.startsWith("assets/brand/") ||
    file.startsWith("assets/images/seva-") ||
    file.endsWith(".webp") ||
    /^(cctv-|housing-society-cctv-).*\.html$/.test(file)
);
for (const file of files) {
  const destination = new URL(`../operations/public/${file}`, import.meta.url);
  await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
  await copyFile(new URL(`../${file}`, import.meta.url), destination);
}
// The native homepage mounts the static body and imports its CSS from the public layout.
await copyFile(
  new URL("../styles.css", import.meta.url),
  new URL("../operations/src/app/(public)/public.css", import.meta.url)
);
await copyFile(
  new URL("../recommendation.mjs", import.meta.url),
  new URL("../operations/src/lib/recommendation.mjs", import.meta.url)
);
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");
const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, entry]) => ({
  path: /<loc>__SITE_URL__([^<]*)<\/loc>/.exec(entry)[1],
  lastModified: /<lastmod>([^<]*)<\/lastmod>/.exec(entry)[1]
}));
await writeFile(
  new URL("../operations/src/lib/seo-sitemap.json", import.meta.url),
  JSON.stringify(entries, null, 2) + "\n"
);
// Native Next.js metadata routes now own these URLs; public copies would conflict.
for (const file of ["robots.txt", "sitemap.xml"]) {
  await rm(new URL(`../operations/public/${file}`, import.meta.url), { force: true });
}
console.log(`Synced ${files.length} SEO assets and ${entries.length} sitemap entries.`);
