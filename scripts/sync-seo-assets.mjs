/** Keep SEO pages, responsive images and native crawl data in the operations runtime. */
import { copyFile, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES } from "./site-config.mjs";

const files = PUBLIC_FILES.filter(
  (file) =>
    file === "index.html" ||
    file === "styles.css" ||
    file.endsWith(".webp") ||
    /^(cctv-|housing-society-cctv-).*\.html$/.test(file)
);
for (const file of files) {
  const destination = new URL(`../operations/public/${file}`, import.meta.url);
  await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
  await copyFile(new URL(`../${file}`, import.meta.url), destination);
}
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
