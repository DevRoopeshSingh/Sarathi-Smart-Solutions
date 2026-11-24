import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_FILES } from "../scripts/site-config.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const serviceSlugs = [
  "cctv-installation-mira-bhayandar",
  "cctv-repair-amc-mira-bhayandar",
  "housing-society-cctv-mira-bhayandar",
  "wifi-networking-mira-bhayandar",
  "smart-home-automation-mira-bhayandar"
];

test("Phase 3: All 5 service landing pages exist and are registered in PUBLIC_FILES", () => {
  for (const slug of serviceSlugs) {
    const filename = `${slug}.html`;
    assert.ok(fs.existsSync(path.join(ROOT_DIR, filename)), `${filename} must exist on disk`);
    assert.ok(
      PUBLIC_FILES.includes(filename),
      `${filename} must be registered in PUBLIC_FILES in site-config.mjs`
    );
  }
});

test("Phase 3: Each service page has complete local SEO metadata, schema, and canonical URLs", () => {
  const titles = new Set();
  const descriptions = new Set();

  for (const slug of serviceSlugs) {
    const content = fs.readFileSync(path.join(ROOT_DIR, `${slug}.html`), "utf8");

    // Title & meta description uniqueness
    const titleMatch = content.match(/<title>(.*?)<\/title>/s);
    assert.ok(titleMatch, `${slug} must have a <title> tag`);
    const cleanTitle = titleMatch[1].trim();
    assert.ok(cleanTitle.includes("Mira-Bhayandar"), `${slug} title must mention Mira-Bhayandar`);
    assert.ok(!titles.has(cleanTitle), `${slug} title must be unique`);
    titles.add(cleanTitle);

    const descMatch =
      content.match(/<meta[^>]*?name="description"[^>]*?content="([^"]+)"/s) ||
      content.match(/<meta[^>]*?content="([^"]+)"[^>]*?name="description"/s);
    assert.ok(descMatch, `${slug} must have a meta description`);
    const cleanDesc = descMatch[1].trim();
    assert.ok(cleanDesc.length >= 50, `${slug} meta description must be informative`);
    assert.ok(!descriptions.has(cleanDesc), `${slug} description must be unique`);
    descriptions.add(cleanDesc);

    // Canonical & OpenGraph
    assert.ok(
      content.includes(`<link rel="canonical" href="__SITE_URL__/${slug}" />`),
      `${slug} must have proper canonical link`
    );
    assert.ok(content.includes('property="og:title"'), `${slug} must have og:title`);
    assert.ok(content.includes('property="og:description"'), `${slug} must have og:description`);
    assert.ok(content.includes('property="og:image"'), `${slug} must have og:image`);
    assert.ok(content.includes('name="twitter:card"'), `${slug} must have twitter:card`);

    // Schema JSON-LD
    const jsonLdMatch = content.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    assert.ok(jsonLdMatch, `${slug} must contain structured data JSON-LD`);
    const parsedSchema = JSON.parse(jsonLdMatch[1]);
    assert.ok(Array.isArray(parsedSchema), `${slug} schema must be an array`);

    const serviceSchema = parsedSchema.find((s) => s["@type"] === "Service");
    assert.ok(serviceSchema, `${slug} must have Service schema`);
    assert.ok(
      serviceSchema.areaServed.includes("Mira Road"),
      `${slug} areaServed must include Mira Road`
    );
    assert.ok(
      serviceSchema.areaServed.includes("Bhayandar East"),
      `${slug} areaServed must include Bhayandar East`
    );

    const breadcrumbSchema = parsedSchema.find((s) => s["@type"] === "BreadcrumbList");
    assert.ok(breadcrumbSchema, `${slug} must have BreadcrumbList schema`);

    const faqSchema = parsedSchema.find((s) => s["@type"] === "FAQPage");
    assert.ok(faqSchema, `${slug} must have FAQPage schema`);
    assert.ok(faqSchema.mainEntity.length >= 3, `${slug} must have at least 3 FAQ items in schema`);
  }
});

test("Phase 3: Each service page has conversion CTAs, phone numbers, and mobile floating contact bar", () => {
  for (const slug of serviceSlugs) {
    const content = fs.readFileSync(path.join(ROOT_DIR, `${slug}.html`), "utf8");

    // Click to call
    assert.ok(
      content.includes('href="tel:+918369704457"'),
      `${slug} must contain clickable phone number tel:+918369704457`
    );

    // WhatsApp CTA
    assert.ok(
      content.includes("https://wa.me/918369704457?text="),
      `${slug} must contain WhatsApp link with prefilled text`
    );

    // Sticky floating mobile contact bar
    assert.ok(
      content.includes('class="floating-contact cctv-contact"'),
      `${slug} must have floating contact bar`
    );
    assert.ok(
      content.includes('class="contact-pill call-pill"'),
      `${slug} floating bar must include call pill`
    );
    assert.ok(
      content.includes('class="contact-pill wa-pill"'),
      `${slug} floating bar must include WhatsApp pill`
    );

    // Real media card
    assert.ok(
      content.includes('class="seo-media-card"'),
      `${slug} must contain genuine installation media showcase`
    );

    // Detail sections and FAQs
    assert.ok(content.includes('class="seo-detail-card"'), `${slug} must contain detail cards`);
    assert.ok(content.includes('class="seo-faq-card"'), `${slug} must contain FAQ cards`);

    // Local service areas
    assert.ok(
      content.includes('class="seo-areas-list"'),
      `${slug} must highlight local service areas`
    );
  }
});

test("Phase 3: Cross-service internal linking links all 5 services", () => {
  for (const slug of serviceSlugs) {
    const content = fs.readFileSync(path.join(ROOT_DIR, `${slug}.html`), "utf8");
    for (const otherSlug of serviceSlugs) {
      if (otherSlug !== slug) {
        assert.ok(
          content.includes(`/${otherSlug}`),
          `${slug} must link to related service ${otherSlug}`
        );
      }
    }
  }

  // index.html cross-links
  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, "index.html"), "utf8");
  assert.ok(
    indexHtml.includes("/wifi-networking-mira-bhayandar"),
    "index.html must link to Wi-Fi landing page"
  );
  assert.ok(
    indexHtml.includes("/smart-home-automation-mira-bhayandar"),
    "index.html must link to Smart Home landing page"
  );
});

test("Phase 3: sitemap.xml and _headers include all 5 service landing pages", () => {
  const sitemapXml = fs.readFileSync(path.join(ROOT_DIR, "sitemap.xml"), "utf8");
  const headers = fs.readFileSync(path.join(ROOT_DIR, "_headers"), "utf8");

  for (const slug of serviceSlugs) {
    assert.ok(sitemapXml.includes(`__SITE_URL__/${slug}`), `sitemap.xml must include ${slug}`);
    assert.ok(headers.includes(`/${slug}`), `_headers must include cache rule for /${slug}`);
  }
});
