/**
 * Cross-platform build script for Sarathi Smart Solutions
 *
 * Runs natively on Windows, macOS, and Linux without external dependencies
 * or shell-specific commands like 'rm -rf' or 'cp'.
 */

import { rm, mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST_DIR = join(ROOT_DIR, "dist");

const ASSETS_TO_COPY = [
  "index.html",
  "styles.css",
  "app.js",
  "recommendation.mjs",
  "01_icon_primary.png",
  "robots.txt",
  "sitemap.xml"
];

async function build() {
  console.log("Starting cross-platform production build...");

  // 1. Clean existing dist directory
  await rm(DIST_DIR, { recursive: true, force: true });
  console.log("✓ Cleaned dist/ directory");

  // 2. Create fresh dist directory
  await mkdir(DIST_DIR, { recursive: true });

  // 3. Copy public production assets
  for (const file of ASSETS_TO_COPY) {
    const src = join(ROOT_DIR, file);
    const dest = join(DIST_DIR, file);
    await copyFile(src, dest);
    console.log(`✓ Copied ${file} -> dist/${file}`);
  }

  console.log(`\nBuild complete! ${ASSETS_TO_COPY.length} static assets ready in dist/`);
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
