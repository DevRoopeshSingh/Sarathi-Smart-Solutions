import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getSiteUrl, PUBLIC_FILES, renderPublicText } from "../scripts/site-config.mjs";

test("development fallback is isolated from strict production URL configuration", () => {
  assert.equal(getSiteUrl({ env: {} }), "http://127.0.0.1:8080");
  assert.equal(
    getSiteUrl({ production: true, env: { SITE_URL: "https://sarathi.example/" } }),
    "https://sarathi.example"
  );
  for (const value of [
    undefined,
    "http://example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://example.com/path",
    "https://user:secret@example.com",
    "https://example.com?x=1",
    "javascript:alert(1)"
  ]) {
    assert.throws(() => getSiteUrl({ production: true, env: { SITE_URL: value } }));
  }
});

test("public URL templates consistently resolve for HTML, sitemap and robots without localhost", async () => {
  for (const filename of PUBLIC_FILES.filter((file) => /\.(html|xml|txt)$/.test(file))) {
    const source = await readFile(new URL(`../${filename}`, import.meta.url), "utf8");
    const rendered = renderPublicText(source, "https://sarathi.example");
    assert.doesNotMatch(rendered, /localhost|127\.0\.0\.1|__SITE_URL__/);
    if (["index.html", "sitemap.xml", "robots.txt"].includes(filename))
      assert.match(rendered, /https:\/\/sarathi\.example/);
  }
});
