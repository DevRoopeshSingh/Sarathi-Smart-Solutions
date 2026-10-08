import { test, expect } from "@playwright/test";

test("slow hero photo preserves content and dimensions, then clears its skeleton", async ({
  page
}, testInfo) => {
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(/camera-mounting-\d+\.webp$/, async (route) => {
    await waiting;
    await route.continue();
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const frame = page.locator(".hero-photo");
  await expect(frame).toHaveAttribute("data-image-state", "loading");
  await expect(frame).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Get Quote on WhatsApp", exact: true })
  ).toBeVisible();
  await expect(page.locator(".hero-price-card")).toContainText("₹13,900");
  const before = await frame.boundingBox();
  await frame.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("slow-photo-mobile.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await frame.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe("none");
  release();
  await expect(frame).toHaveAttribute("data-image-state", "ready");
  await expect(frame).not.toHaveClass(/is-image-loading/);
  await expect(frame).not.toHaveAttribute("aria-busy");
  const after = await frame.boundingBox();
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
});

for (const [route, selector, pattern] of [
  ["/", ".hero-photo", /camera-mounting-\d+\.webp$/],
  ["/digital-seva-kendra", ".seva-showcase-media", /seva-.*\.jpg$/]
]) {
  test(`${route}: failed photos stop loading and keep enquiries usable`, async ({ page }) => {
    await page.route(pattern, (request) => request.abort());
    await page.goto(route);
    const frame = page.locator(selector).first();
    await frame.scrollIntoViewIfNeeded();
    await expect(frame).toHaveAttribute("data-image-state", "error");
    await expect(frame).not.toHaveAttribute("aria-busy");
    await expect(frame.locator(".image-load-message")).toContainText("Photo unavailable.");
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.locator('a[href*="wa.me"]').count()).toBeGreaterThan(0);
  });
}

test("loaded gallery photos and repeat initialisation leave no skeletons", async ({ page }) => {
  await page.goto("/");
  const frames = page.locator("#work-gallery [data-image-placeholder]");
  for (const frame of await frames.all()) {
    await frame.scrollIntoViewIfNeeded();
    await expect(frame).toHaveAttribute("data-image-state", "ready");
    await expect(frame).not.toHaveClass(/is-image-loading/);
  }
  await page.evaluate(async () => {
    const { initImagePlaceholders } = await import("/image-loading.mjs");
    initImagePlaceholders();
  });
  await expect(page.locator(".is-image-loading, .image-load-message")).toHaveCount(0);
});

test("photos and contact details remain available without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".hero-photo img")).toBeVisible();
  await expect(page.locator("#hero-title")).toBeVisible();
  await expect(page.locator(".hero-photo")).not.toHaveAttribute("aria-busy");
  await expect(page.locator(".is-image-loading")).toHaveCount(0);
  await context.close();
});
