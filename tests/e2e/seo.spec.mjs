import { test, expect } from "@playwright/test";

const services = [
  "cctv-installation-mira-bhayandar",
  "cctv-repair-amc-mira-bhayandar",
  "housing-society-cctv-mira-bhayandar"
];

async function checkPhotoPreview(page, request) {
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /index, follow, max-image-preview:large/
  );
  const photo = await page.locator('meta[property="og:image"]').getAttribute("content");
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(new URL(photo).origin).toBe(new URL(canonical).origin);
  expect(new URL(photo).pathname).toMatch(/^\/assets\/images\/.+\.(webp|jpg)$/);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", photo);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image"
  );
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    "content",
    /^Illustrative /
  );
  const response = await request.get(new URL(photo).pathname);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain(
    await page.locator('meta[property="og:image:type"]').getAttribute("content")
  );
  return photo;
}

for (const slug of services) {
  test(`${slug}: initial HTML is indexable, linked and usable without JavaScript`, async ({
    browser,
    request
  }, testInfo) => {
    const response = await request.get(`/${slug}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toContain("__SITE_URL__");
    expect(html).toContain('content="index, follow, max-image-preview:large"');
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 900 }
    });
    const page = await context.newPage();
    await page.goto(`/${slug}`);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/${slug}$`)
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      await page.locator('link[rel="canonical"]').getAttribute("href")
    );
    const data = await page
      .locator('script[type="application/ld+json"]')
      .evaluate((script) => JSON.parse(script.textContent));
    expect(data.map((item) => item["@type"])).toEqual(["Service", "BreadcrumbList"]);
    expect(data[0].provider.address.streetAddress).toContain("RNP Park");
    expect(data[0].image).toBe(await checkPhotoPreview(page, request));
    expect(data[0].mainEntityOfPage).toBe(
      await page.locator('link[rel="canonical"]').getAttribute("href")
    );
    const enquiry = new URL(
      await page.locator('.seo-actions a[href*="wa.me"]').getAttribute("href")
    );
    expect(enquiry.searchParams.get("text")).toContain(data[0].name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320
    );
    await page.screenshot({ path: testInfo.outputPath(`${slug}-mobile.png`), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1440
    );
    await page.screenshot({ path: testInfo.outputPath(`${slug}-desktop.png`) });
    for (const href of await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))])) {
      expect((await request.get(href)).status()).toBe(200);
    }
    const home = await request.get("/");
    expect(await home.text()).toContain(`href="/${slug}"`);
    expect(await (await request.get("/sitemap.xml")).text()).toContain(`/${slug}</loc>`);
    await context.close();
  });
}

test("homepage identifies a crawlable CCTV photo separately from its logo", async ({
  page,
  request
}) => {
  await page.goto("/");
  const photo = await checkPhotoPreview(page, request);
  expect(photo).toMatch(/^https?:\/\/.*\/assets\/images\/camera-mounting-1200\.webp$/);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", photo);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "896");
  const data = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) => scripts.flatMap((script) => JSON.parse(script.textContent)));
  const webPage = data.find((item) => item["@type"] === "WebPage");
  const website = data.find((item) => item["@type"] === "WebSite");
  expect(website.name).toBe("Sarathi Smart Solutions");
  expect(new URL(website.url).href).toBe(
    new URL(await page.locator('link[rel="canonical"]').getAttribute("href")).href
  );
  expect(webPage.isPartOf["@id"]).toBe(website["@id"]);
  const business = data.find((item) => item["@type"] === "HomeAndConstructionBusiness");
  expect(webPage.primaryImageOfPage.url).toBe(photo);
  expect(webPage.primaryImageOfPage.width).toBe(1200);
  expect(webPage.primaryImageOfPage.height).toBe(896);
  expect(business.image).toBe(photo);
  expect(business.logo).not.toBe(photo);
  expect(business.logo).toMatch(/sarathi-logo-light-2048\.png$/);
  const response = await request.get(new URL(photo).pathname);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/webp");
  expect((await request.get(new URL(business.logo).pathname)).status()).toBe(200);
  const favicon = page.locator('link[rel="icon"][sizes="128x128"]');
  await expect(favicon).toHaveAttribute("type", "image/png");
  const iconResponse = await request.get(await favicon.getAttribute("href"));
  expect(iconResponse.status()).toBe(200);
  expect(iconResponse.headers()["content-type"]).toContain("image/png");
  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description).toBe(
    "CCTV installation and AMC in Mira Road and Bhayandar. Camera packages, mobile viewing and local support for homes, shops and societies. Request a free survey."
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    description
  );
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
    "content",
    description
  );
});

test("Digital Seva identifies its own service photo and business", async ({ page, request }) => {
  await page.goto("/digital-seva-kendra");
  const photo = await checkPhotoPreview(page, request);
  expect(photo).toContain("/assets/images/seva-citizen-services.jpg");
  const business = await page
    .locator('script[type="application/ld+json"]')
    .evaluate((script) => JSON.parse(script.textContent));
  expect(business.name).toBe("Sarathi Digital Seva Kendra");
  expect(business.image).toBe(photo);
  expect(business.logo).not.toBe(photo);
});

test("homepage gallery serves responsive WebP files with an image content type", async ({
  page,
  request
}) => {
  await page.goto("/");
  const images = page.locator("#work-gallery img");
  await expect(images).toHaveCount(3);
  for (const img of await images.all()) {
    await expect(img).toHaveAttribute("srcset", /480w[\s\S]*960w[\s\S]*1200w/);
    const src = await img.getAttribute("src");
    const response = await request.get(src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/webp");
  }
});
