import { createHash } from "node:crypto";
import path from "node:path";

export const VERSIONED_ASSETS = Object.freeze([
  "styles.css",
  "recommendation.mjs",
  "image-loading.mjs",
  "app.js",
  "locator.js",
  "digital-seva-kendra.js"
]);

/** Compile this site's local runtime assets without changing development source URLs. */
export function versionAssets(sources) {
  const manifest = new Map();
  const files = new Map();
  const visiting = new Set();

  function compile(filename) {
    if (manifest.has(filename)) return manifest.get(filename);
    if (visiting.has(filename)) throw new Error(`Circular asset import: ${filename}`);
    if (!sources.has(filename)) throw new Error(`Missing asset source: ${filename}`);
    visiting.add(filename);
    let content = sources.get(filename);
    if (/\.(js|mjs)$/.test(filename)) {
      content = content.replace(
        /(\bfrom\s*|\bimport\s*(?:\(\s*)?)(["'])(\.\/[^"']+)\2/g,
        (match, prefix, quote, specifier) => {
          const dependency = path.posix.normalize(
            path.posix.join(path.posix.dirname(filename), specifier)
          );
          if (!sources.has(dependency)) {
            throw new Error(`Unversioned local import in ${filename}: ${specifier}`);
          }
          const url = compile(dependency);
          return `${prefix}${quote}./${path.posix.basename(url)}${quote}`;
        }
      );
    }
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
    const extension = path.posix.extname(filename);
    const basename = path.posix.basename(filename, extension);
    const url = `/assets/build/${basename}.${hash}${extension}`;
    files.set(url.slice(1), content);
    manifest.set(filename, url);
    visiting.delete(filename);
    return url;
  }

  for (const filename of sources.keys()) compile(filename);
  return { manifest, files };
}

export function versionHtmlAssets(html, manifest) {
  return html.replace(/\b(src|href)=(['"])([^'"]+)\2/g, (match, attribute, quote, url) => {
    const filename = url.replace(/^(?:\.\/|\/)/, "");
    const versioned = manifest.get(filename);
    return versioned ? `${attribute}=${quote}${versioned}${quote}` : match;
  });
}
