import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PUBLIC_FILES } from "../scripts/site-config.mjs";

test("digital-seva-kendra assets are registered in PUBLIC_FILES", () => {
  assert.ok(PUBLIC_FILES.includes("digital-seva-kendra.html"));
  assert.ok(PUBLIC_FILES.includes("digital-seva-kendra.js"));
  assert.ok(PUBLIC_FILES.includes("assets/images/seva-citizen-services.jpg"));
  assert.ok(PUBLIC_FILES.includes("assets/images/seva-business-gst.jpg"));
  assert.ok(PUBLIC_FILES.includes("assets/images/seva-pharmacy-fda.jpg"));
});

test("digital-seva-kendra.html contains verified business details and clean metadata", async () => {
  const html = await readFile(new URL("../digital-seva-kendra.html", import.meta.url), "utf8");

  // Title and Canonical URL
  assert.match(html, /<title>\s*Sarathi Digital Seva Kendra/);
  assert.match(html, /<link\s+rel="canonical"\s+href="__SITE_URL__\/digital-seva-kendra"/);

  // Dedicated JSON-LD without CCTV leak
  assert.match(html, /"name":\s*"Sarathi Digital Seva Kendra"/);
  assert.match(html, /"telephone":\s*"\+918369704457"/);
  assert.match(html, /"email":\s*"sarathidigitalsevakendra@gmail\.com"/);
  assert.match(html, /"postalCode":\s*"401105"/);
  assert.doesNotMatch(html, /AggregateOffer/);
  assert.doesNotMatch(html, /CCTV installation package/);

  // Key categories present
  assert.match(html, /Citizen &amp; Govt/);
  assert.match(html, /Business &amp; GST/);
  assert.match(html, /Pharmacy &amp; FDA/);
  assert.match(html, /Food &amp; FSSAI/);
  assert.match(html, /Property &amp; MahaRERA/);
  assert.match(html, /E-commerce/);
  assert.match(html, /Student &amp; Career/);
  assert.match(html, /Design &amp; Growth/);
  assert.match(html, /Printing &amp; Xerox/);

  // WhatsApp enquiry links and Phone
  assert.match(html, /https:\/\/wa\.me\/918369704457\?text=/);
  assert.match(html, /href="tel:\+918369704457"/);

  // Showcase images present
  assert.match(html, /src="assets\/images\/seva-citizen-services\.jpg"/);
  assert.match(html, /src="assets\/images\/seva-business-gst\.jpg"/);
  assert.match(html, /src="assets\/images\/seva-pharmacy-fda\.jpg"/);

  // Sister division cross-links
  assert.match(html, /href="\/"/);
});

test("sitemap.xml and _redirects register digital-seva-kendra", async () => {
  const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");
  assert.match(sitemap, /<loc>__SITE_URL__\/digital-seva-kendra<\/loc>/);

  const redirects = await readFile(new URL("../_redirects", import.meta.url), "utf8");
  assert.match(redirects, /\/digital-seva-kendra\s+\/digital-seva-kendra\.html\s+200/);
});

test("homepage links to Digital Seva Kendra", async () => {
  const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(indexHtml, /href="\/digital-seva-kendra"/);
  assert.match(indexHtml, /Sarathi Digital Seva Kendra/);
});

test("static and operations Seva assets stay synchronized", async () => {
  for (const file of ["digital-seva-kendra.html", "digital-seva-kendra.js", "styles.css"]) {
    assert.equal(
      await readFile(new URL(`../${file}`, import.meta.url), "utf8"),
      await readFile(new URL(`../operations/public/${file}`, import.meta.url), "utf8"),
      `${file} must be synchronized by npm run generate:seva`
    );
  }
});
