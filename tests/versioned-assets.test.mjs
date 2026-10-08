import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PUBLIC_FILES } from "../scripts/site-config.mjs";
import {
  VERSIONED_ASSETS,
  versionAssets,
  versionHtmlAssets
} from "../scripts/lib/versioned-assets.mjs";

const sources = new Map(
  await Promise.all(
    VERSIONED_ASSETS.map(async (file) => [
      file,
      await readFile(new URL(`../${file}`, import.meta.url), "utf8")
    ])
  )
);

test("stylesheet changes get a new URL without invalidating unchanged scripts", () => {
  const previous = versionAssets(sources);
  const updated = versionAssets(
    new Map([...sources, ["styles.css", sources.get("styles.css") + "\n/* next deployment */"]])
  );
  assert.notEqual(previous.manifest.get("styles.css"), updated.manifest.get("styles.css"));
  assert.equal(previous.manifest.get("app.js"), updated.manifest.get("app.js"));
  assert.deepEqual(versionAssets(sources), previous);
});

test("a recommendation change invalidates both dependency and importing entry", () => {
  const previous = versionAssets(sources);
  const updated = versionAssets(
    new Map([
      ...sources,
      ["recommendation.mjs", sources.get("recommendation.mjs") + "\n/* changed recommendation */"]
    ])
  );
  for (const file of ["recommendation.mjs", "app.js"]) {
    assert.notEqual(previous.manifest.get(file), updated.manifest.get(file));
  }
  const entry = updated.files.get(updated.manifest.get("app.js").slice(1));
  assert.ok(entry.includes(`"./${updated.manifest.get("recommendation.mjs").split("/").pop()}"`));
  assert.doesNotMatch(entry, /["']\.\/recommendation\.mjs["']/);
});

test("every public HTML file references the matching fingerprinted local assets", async () => {
  const { manifest, files } = versionAssets(sources);
  for (const file of PUBLIC_FILES.filter((file) => file.endsWith(".html"))) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    const html = versionHtmlAssets(source, manifest);
    for (const asset of VERSIONED_ASSETS) {
      if (source.includes(`"${asset}"`)) assert.ok(html.includes(manifest.get(asset)), file);
    }
    for (const [, url] of html.matchAll(/(?:src|href)="(\/assets\/build\/[^"]+)"/g)) {
      assert.ok(files.has(url.slice(1)), `Missing built resource ${url}`);
    }
    assert.doesNotMatch(
      html,
      /(?:src|href)="(?:styles\.css|app\.js|locator\.js|digital-seva-kendra\.js)"/
    );
  }
});

test("local development URLs and external URLs remain unaffected until build", () => {
  const { manifest } = versionAssets(sources);
  const html =
    '<a href="/privacy.html">Policy</a><link href="https://example.com/styles.css"><script src="/app.js"></script>';
  assert.equal(
    versionHtmlAssets(html, manifest),
    html.replace('src="/app.js"', `src="${manifest.get("app.js")}"`)
  );
});

test("unknown local imports and cycles fail instead of emitting inconsistent assets", () => {
  assert.throws(
    () => versionAssets(new Map([["app.js", 'import "./missing.mjs";']])),
    /Unversioned local import/
  );
  assert.throws(
    () =>
      versionAssets(
        new Map([
          ["app.js", 'import "./dependency.mjs";'],
          ["dependency.mjs", 'import "./app.js";']
        ])
      ),
    /Circular asset import/
  );
});

test("literal dynamic imports resolve to the same versioned dependency", () => {
  const { manifest, files } = versionAssets(
    new Map([
      ["app.js", 'export const load = () => import("./recommendation.mjs");'],
      ["recommendation.mjs", "export const value = 1;"]
    ])
  );
  assert.ok(
    files
      .get(manifest.get("app.js").slice(1))
      .includes(`import("./${manifest.get("recommendation.mjs").split("/").pop()}")`)
  );
});

test("HTML and legacy runtime URLs revalidate with no conflicting immutable rule", async () => {
  const headers = await readFile(new URL("../_headers", import.meta.url), "utf8");
  const rules = headers.split(/\n\s*\n/).map((block) => {
    const [pattern, ...lines] = block.trim().split("\n");
    const cache = lines.find((line) => /^\s*Cache-Control:/i.test(line));
    const regex = new RegExp(
      `^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`
    );
    return { regex, cache: cache?.trim() };
  });
  const routes = [
    "/",
    ...PUBLIC_FILES.filter((file) => file.endsWith(".html")).flatMap((file) => [
      `/${file}`,
      `/${file.slice(0, -5)}`
    ]),
    ...VERSIONED_ASSETS.map((file) => `/${file}`)
  ];
  for (const route of routes) {
    const policies = rules
      .filter((rule) => rule.cache && rule.regex.test(route))
      .map((rule) => rule.cache);
    assert.deepEqual(policies, ["Cache-Control: public, max-age=0, must-revalidate"], route);
  }
  for (const url of versionAssets(sources).manifest.values()) {
    const policies = rules
      .filter((rule) => rule.cache && rule.regex.test(url))
      .map((rule) => rule.cache);
    assert.deepEqual(policies, ["Cache-Control: public, max-age=31536000, immutable"], url);
  }
});
