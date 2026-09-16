/**
 * Cross-platform build script for Sarathi Smart Solutions
 *
 * Runs natively on Windows, macOS, and Linux without external dependencies
 * or shell-specific commands like 'rm -rf' or 'cp'.
 */

import { rm, mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES, getSiteUrl, renderPublicText } from "./site-config.mjs";

const ROOT_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST_DIR = join(ROOT_DIR, "dist");

const ASSETS_TO_COPY = PUBLIC_FILES;

async function build() {
  // Validate before touching an existing build. Development fallback never enters dist/.
  const siteUrl = getSiteUrl({ production: true });
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
    if (/\.(html|txt|xml)$/.test(file)) {
      await writeFile(dest, renderPublicText(await readFile(src, "utf8"), siteUrl));
    } else {
      await copyFile(src, dest);
    }
    console.log(`✓ Copied ${file} -> dist/${file}`);
  }

  console.log(`\nBuild complete! ${ASSETS_TO_COPY.length} static assets ready in dist/`);
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
