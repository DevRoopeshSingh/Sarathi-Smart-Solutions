import { test, expect } from "@playwright/test";

const services = [
  "cctv-installation-mira-bhayandar",
  "cctv-repair-amc-mira-bhayandar",
  "housing-society-cctv-mira-bhayandar"
];

for (const slug of services) {
  test(`${slug}: initial HTML is indexable, linked and usable without JavaScript`, async ({
    browser,
    request
  }, testInfo) => {
    const response = await request.get(`/${slug}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toContain("__SITE_URL__");
    expect(html).toContain('<meta name="robots" content="index, follow"');
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

test("homepage gallery serves responsive WebP files with an image content type", async ({
  page,
  request
}) => {
  await page.goto("/");
  const images = page.locator("#work-gallery img");
  await expect(images).toHaveCount(6);
  for (const img of await images.all()) {
    await expect(img).toHaveAttribute("srcset", /480w[\s\S]*960w[\s\S]*1200w/);
    const src = await img.getAttribute("src");
    const response = await request.get(src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/webp");
  }
});
