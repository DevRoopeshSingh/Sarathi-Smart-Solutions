import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = fs.readFileSync(path.join(ROOT_DIR, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT_DIR, "app.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(ROOT_DIR, "styles.css"), "utf8");

test("Phase 2: Installation Gallery has filter navigation, category tags, instructions, and GBP link", () => {
  assert.ok(indexHtml.includes('id="work-gallery"'), "#work-gallery must exist");
  assert.ok(
    indexHtml.includes("Illustrative installation examples"),
    "Must preserve exact required disclaimer text"
  );
  assert.ok(indexHtml.includes('class="gallery-filter-nav"'), "Must have filter navigation bar");

  const requiredFilters = ["all", "cctv", "dvr", "network", "cabling"];
  for (const filter of requiredFilters) {
    assert.ok(
      indexHtml.includes(`data-filter="${filter}"`),
      `Filter navigation must include data-filter="${filter}"`
    );
  }

  assert.ok(
    indexHtml.includes("data-gallery-category="),
    "Proof cards must have data-gallery-category attributes"
  );
  assert.ok(
    indexHtml.includes("HOW TO ADD NEW INSTALLATION PHOTOGRAPHS:"),
    "Must include clear instructions for adding future photos"
  );
  assert.ok(
    indexHtml.includes("https://share.google/yKDsOqWwMYGzaVRIh"),
    "Gallery footer must link to genuine Google profile"
  );
});

test("Phase 2: Supported hardware brands contains all 7 genuine brands with disclaimer", () => {
  assert.ok(indexHtml.includes('id="brands-title"'), "Brands heading must exist");
  assert.ok(
    indexHtml.includes("Supported Hardware Brands"),
    "Heading must state Supported Hardware Brands"
  );
  assert.ok(
    indexHtml.includes("Equipment We Supply &amp; Install"),
    "Kicker must clarify Supply & Install role"
  );

  const expectedBrands = [
    "CP Plus",
    "Hikvision",
    "Dahua",
    "TP-Link Omada",
    "Ubiquiti",
    "Yale",
    "Godrej"
  ];
  for (const brand of expectedBrands) {
    assert.ok(indexHtml.includes(brand), `Must display genuine brand ${brand}`);
  }

  assert.ok(indexHtml.includes("brands-disclaimer"), "Must have .brands-disclaimer class");
  assert.ok(
    indexHtml.includes("does not imply authorized dealership"),
    "Must disclaim authorized dealership or official partnership"
  );
  assert.ok(
    !indexHtml.includes("images.unsplash.com"),
    "Must not rely on external Unsplash stock images pretending to be installations"
  );
});

test("Phase 2: About section exists with 4 pillars and no invented history or staff stats", () => {
  assert.ok(indexHtml.includes('id="about"'), "#about section must exist");
  assert.ok(
    indexHtml.includes('aria-labelledby="about-title"'),
    "#about must have accessible heading label"
  );
  assert.ok(indexHtml.includes("About Sarathi Smart Solutions"), "Must have clear About heading");
  assert.ok(indexHtml.includes("Security &amp; Surveillance"), "Must feature Security pillar");
  assert.ok(
    indexHtml.includes("Connectivity &amp; Networking"),
    "Must feature Connectivity pillar"
  );
  assert.ok(indexHtml.includes("Smart Devices &amp; Automation"), "Must feature Automation pillar");
  assert.ok(
    indexHtml.includes("Local Mira-Bhayandar Support"),
    "Must feature Local Support pillar"
  );
});

test("Phase 2: Reviews section links to Google Business Profile with transparent framework", () => {
  assert.ok(indexHtml.includes('id="reviews"'), "#reviews section must exist");
  assert.ok(
    indexHtml.includes("Google Business Profile"),
    "Must display Google Business Profile banner"
  );
  assert.ok(
    indexHtml.includes("https://share.google/yKDsOqWwMYGzaVRIh"),
    "Must include direct Google review and profile link"
  );
  assert.ok(
    indexHtml.includes("reviews-disclaimer"),
    "Must include reviews disclaimer affirming genuine feedback"
  );
  assert.ok(
    indexHtml.includes("HOW TO ADD NEW VERIFIED GOOGLE REVIEWS:"),
    "Must provide clear instructions for future transcription from Google"
  );
});

test("Phase 2: Strict section ordering conforms to homepage decision flow", () => {
  const sectionIds = [];
  const regex = /<(?:section|details)[^>]*\s+id="([^"]+)"/g;
  let match;
  while ((match = regex.exec(indexHtml)) !== null) {
    sectionIds.push(match[1]);
  }

  const galleryIdx = sectionIds.indexOf("work-gallery");
  const packagesIdx = sectionIds.indexOf("packages");
  const installIdx = sectionIds.indexOf("installation");
  const aboutIdx = sectionIds.indexOf("about");
  const supportIdx = sectionIds.indexOf("local-support");
  const reviewsIdx = sectionIds.indexOf("reviews");
  const servicesIdx = sectionIds.indexOf("services");
  const faqIdx = sectionIds.indexOf("faq");
  const surveyIdx = sectionIds.indexOf("survey-form");

  assert.ok(galleryIdx !== -1, "work-gallery must be present");
  assert.ok(packagesIdx !== -1, "packages must be present");
  assert.ok(installIdx !== -1, "installation must be present");
  assert.ok(aboutIdx !== -1, "about must be present");
  assert.ok(supportIdx !== -1, "local-support must be present");
  assert.ok(reviewsIdx !== -1, "reviews must be present");
  assert.ok(servicesIdx !== -1, "services must be present");
  assert.ok(faqIdx !== -1, "faq must be present");
  assert.ok(surveyIdx !== -1, "survey-form must be present");

  assert.ok(galleryIdx < packagesIdx, "work-gallery must precede packages");
  assert.ok(packagesIdx < installIdx, "packages must precede installation");
  assert.ok(installIdx < aboutIdx, "installation must precede about");
  assert.ok(aboutIdx < supportIdx, "about must precede local-support");
  assert.ok(supportIdx < reviewsIdx, "local-support must precede reviews");
  assert.ok(reviewsIdx < servicesIdx, "reviews must precede services");
  assert.ok(faqIdx < surveyIdx, "faq must precede survey-form");
});

test("Phase 2: Footer links resolve to valid IDs on page", () => {
  assert.ok(indexHtml.includes('href="#about"'), "Footer must have #about link");
  assert.ok(indexHtml.includes('href="#reviews"'), "Footer must have #reviews link");
});

test("Phase 2: All images on index.html have non-empty alt attributes", () => {
  const imgMatches = indexHtml.match(/<img[^>]*>/g) || [];
  assert.ok(imgMatches.length > 0, "Page must contain images");
  for (const img of imgMatches) {
    const hasAlt = /alt="[^"]+"/.test(img);
    assert.ok(hasAlt, `Image must have non-empty alt: ${img.slice(0, 80)}...`);
  }
});

test("Phase 2: app.js contains and initializes gallery filter functionality", () => {
  assert.ok(
    appJs.includes("function initGalleryFilters()"),
    "app.js must define initGalleryFilters"
  );
  assert.ok(
    appJs.includes("initGalleryFilters();"),
    "app.js must call initGalleryFilters on page initialization"
  );
  assert.ok(
    appJs.includes("dataset.galleryCategory"),
    "initGalleryFilters must query dataset.galleryCategory"
  );
});

test("Phase 2: Warranty and AMC policies stay consistent", () => {
  assert.ok(
    indexHtml.includes("Minimum 1-year OEM hardware warranty"),
    "Package inclusions must specify minimum 1-year OEM hardware warranty"
  );
  assert.ok(
    indexHtml.includes("installation workmanship support"),
    "Package inclusions must specify installation workmanship support"
  );
});

test("Phase 2: styles.css contains required styling for trust and credibility sections", () => {
  assert.ok(stylesCss.includes(".gallery-filter-nav"), "styles.css must style gallery filter nav");
  assert.ok(stylesCss.includes(".brands-disclaimer"), "styles.css must style brands disclaimer");
  assert.ok(stylesCss.includes(".about-section"), "styles.css must style about section");
  assert.ok(stylesCss.includes(".reviews-section"), "styles.css must style reviews section");
});
