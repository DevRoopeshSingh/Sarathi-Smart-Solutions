/**
 * Zero-dependency local static preview server
 *
 * Used for local development and Playwright end-to-end testing.
 * Runs natively on Windows, macOS, and Linux without external packages.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES, getSiteUrl, renderPublicText } from "./site-config.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

const siteUrl = getSiteUrl();
const server = http.createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;
  const filename = pathname === "/" ? "index.html" : pathname.slice(1);
  const found = PUBLIC_FILES.includes(filename);
  const publicFile = found ? filename : "404.html";
  fs.readFile(path.join(ROOT_DIR, publicFile), (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Unable to load page");
      return;
    }
    const ext = path.extname(publicFile).toLowerCase();
    if ([".html", ".txt", ".xml"].includes(ext)) {
      data = renderPublicText(data.toString("utf8"), siteUrl);
      if (publicFile === "robots.txt")
        data = `User-agent: *\nDisallow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
    }
    res.writeHead(found ? 200 : 404, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
});
