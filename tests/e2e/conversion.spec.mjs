import { test, expect } from "@playwright/test";

async function fillLead(form) {
  await form.locator('[name="leadName"]').fill("Test Customer");
  await form.locator('[name="leadPhone"]').fill("+91 98765 43210");
  await form.locator('[name="leadLocality"]').selectOption("Bhayandar East");
  await form.locator('[name="leadSpace"]').selectOption("Shop / Commercial");
  await form.locator('[name="leadService"]').selectOption("CCTV AMC & maintenance");
  await form
    .locator('[name="leadRequirement"]')
    .fill("Four cameras; recording stops & needs checking.");
  await form.locator('[name="leadConsent"]').check();
}

for (const [source, width] of [
  ["hero-quick-survey", 1440],
  ["contact-survey", 375]
]) {
  test(`${source}: validates, prepares an honest private handoff and prevents duplicates`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("sarathi_leads", '[{"name":"old private lead"}]');
      window.openedEnquiries = [];
      window.conversionEvents = [];
      window.open = (...args) => {
        window.openedEnquiries.push(args);
        return null;
      };
      window.addEventListener("sarathi:event", (event) =>
        window.conversionEvents.push(event.detail)
      );
    });
    await page.goto("/");
    const form = page.locator(`[data-form-source="${source}"]`);
    await expect(form.locator('[name="leadConsent"]')).not.toBeChecked();
    await form.locator('[type="submit"]').click();
    await expect(form.locator('[name="leadName"]')).toBeFocused();
    await expect(form.locator(".lead-field-error:visible")).toHaveCount(5);
    await fillLead(form);
    await form.locator('[name="leadPhone"]').fill("98765abc43210");
    await form.locator('[type="submit"]').click();
    await expect(form.locator('[name="leadPhone"]')).toBeFocused();
    expect(await page.evaluate(() => window.openedEnquiries.length)).toBe(0);
    await form.locator('[name="leadPhone"]').fill("+91 98765 43210");
    await form.locator('[type="submit"]').click();
    await expect(form.locator(".lead-feedback")).toContainText("not booked until we confirm");
    await expect(form.locator('[type="submit"]')).toBeDisabled();
    const handoff = form.locator(".lead-handoff a");
    await expect(handoff).toBeVisible();
    const url = new URL(await handoff.getAttribute("href"));
    expect(url.origin + url.pathname).toBe("https://wa.me/918369704457");
    expect(url.searchParams.get("text")).toContain("Property: Shop / Commercial");
    expect(url.searchParams.get("text")).toContain("Service: CCTV AMC & maintenance");
    expect(url.searchParams.get("text")).toContain(
      "Four cameras; recording stops & needs checking."
    );
    expect(await page.evaluate(() => localStorage.getItem("sarathi_leads"))).toBeNull();
    expect(JSON.stringify(await page.evaluate(() => window.conversionEvents))).not.toMatch(
      /Test Customer|98765|Four cameras/
    );
    await expect(form.locator('[type="submit"]')).toBeEnabled();
    await form.locator('[type="submit"]').click();
    expect(await page.evaluate(() => window.openedEnquiries.length)).toBe(1);
    await expect(form.locator(".lead-feedback")).toContainText("already prepared");
    // Editing removes a stale message and allows a distinct enquiry.
    await form.locator('[name="leadRequirement"]').fill("New requirement");
    await expect(form.locator(".lead-handoff")).toBeHidden();
    await form.locator('[type="submit"]').click();
    expect(await page.evaluate(() => window.openedEnquiries.length)).toBe(2);
    await expect(form.locator(".lead-handoff a")).toHaveAttribute("href", /New%20requirement/);
  });
}

test("honeypot and unavailable storage do not expose or lose enquiries", async ({ page }) => {
  await page.addInitScript(() => {
    window.openedEnquiries = [];
    window.open = (...args) => {
      window.openedEnquiries.push(args);
      throw new Error("Popup blocked");
    };
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      }
    });
  });
  await page.goto("/");
  const form = page.locator('[data-form-source="contact-survey"]');
  await fillLead(form);
  await form.locator('[name="botcheck"]').evaluate((input) => {
    input.value = "spam";
  });
  await form.locator('[type="submit"]').click();
  expect(await page.evaluate(() => window.openedEnquiries.length)).toBe(0);
  await form.locator('[name="botcheck"]').evaluate((input) => {
    input.value = "";
  });
  await form.locator('[type="submit"]').click();
  await expect(form.locator(".lead-handoff a")).toBeVisible();
  await expect(form.locator(".lead-feedback")).toContainText("Send it in WhatsApp");
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`homepage at ${width}px retains first-screen actions and fits the viewport`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(".hero-actions a").first()).toHaveAccessibleName(
      "Get Quote on WhatsApp"
    );
    await expect(page.locator(".hero-actions a").first()).toBeInViewport();
    const bar = page.locator(".floating-contact");
    await expect(bar).toBeInViewport();
    for (const button of await bar.locator("a").all()) {
      const box = await button.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`) });
    if (width === 375 || width === 1440) {
      await page
        .locator("#services")
        .screenshot({ path: testInfo.outputPath(`services-${width}.png`) });
      const workGallery = page.locator("#work-gallery");
      await workGallery.scrollIntoViewIfNeeded();
      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll("#work-gallery img"));
        await Promise.all(images.map((img) => img.decode().catch(() => {})));
      });
      await workGallery.screenshot({ path: testInfo.outputPath(`proof-${width}.png`) });
    }
    await page.locator('.floating-contact a[href="#survey-form"]').click();
    await expect(page.locator("#survey-title")).toBeInViewport();
    // Native keyboard activation and accordion navigation.
    const faq = page.locator("#faq-btn-2");
    await faq.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#faq-panel-2")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("#faq-btn-3")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
  });
}

test("all FAQ schema answers match readable content; internal links and package URLs resolve", async ({
  page,
  request
}) => {
  await page.goto("/");
  const faqSchema = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts.map((s) => JSON.parse(s.textContent)).find((s) => s["@type"] === "FAQPage")
    );
  for (const [index, item] of faqSchema.mainEntity.entries()) {
    const button = page.locator(`#faq-btn-${index + 1}`);
    if ((await button.getAttribute("aria-expanded")) === "false") await button.click();
    const panel = page.locator(`#faq-panel-${index + 1}`);
    await expect(panel).toBeVisible();
    expect((await panel.innerText()).replace(/\s+/g, " ").trim()).toBe(item.acceptedAnswer.text);
  }
  const urls = await page
    .locator("a[href]")
    .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")))]);
  for (const url of urls) {
    if (url.startsWith("#") && url.length > 1) await expect(page.locator(url)).toHaveCount(1);
    else if (!/^(https?:|tel:|mailto:|#)/.test(url))
      expect((await request.get(url)).status()).toBe(200);
  }
  expect(await page.locator("img:not([alt]), img[alt='']").count()).toBe(0);
  for (const [index, price] of ["13,900", "15,900", "17,900", "30,900"].entries()) {
    const card = page.locator(".package-card").nth(index);
    await expect(card).toContainText(`₹${price}`);
    const url = new URL(await card.locator(".package-cta").getAttribute("href"));
    expect(url.pathname).toBe("/918369704457");
    expect(url.searchParams.get("text")).toContain(`₹${price}`);
  }
  expect((await request.get("/.git/config")).status()).toBe(404);
  expect((await request.get("/?campaign=test")).status()).toBe(200);
});

test("without JavaScript, forms cannot leak details into a GET URL", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  for (const submit of await page.locator(".lead-submit-btn").all())
    await expect(submit).toBeDisabled();
  await expect(page.locator(".hero-actions a").first()).toHaveAttribute(
    "href",
    /^https:\/\/wa.me\//
  );
  await context.close();
});

test("keyboard form flow, reduced motion and local performance snapshot", async ({
  page
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.auditMetrics = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.auditMetrics.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!entry.hadRecentInput) window.auditMetrics.cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
    window.open = () => null;
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const metrics = await page.evaluate(() => ({
    ...window.auditMetrics,
    domContentLoadedMs: performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd,
    resourceCount: performance.getEntriesByType("resource").length,
    transferredBytes: performance
      .getEntriesByType("resource")
      .reduce((sum, entry) => sum + entry.transferSize, 0),
    viewport: { width: innerWidth, height: innerHeight },
    initialFocus: document.activeElement.tagName,
    scrollY
  }));
  await testInfo.attach("local-performance.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json"
  });
  console.log("Local performance snapshot:", JSON.stringify(metrics));
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#planner")).toBeInViewport();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    "auto"
  );
  const form = page.locator('[data-form-source="contact-survey"]');
  await form.locator('[name="leadName"]').focus();
  await page.keyboard.type("Keyboard Customer");
  await page.keyboard.press("Tab");
  await expect(form.locator('[name="leadPhone"]')).toBeFocused();
  await page.keyboard.type("9876543210");
  await page.keyboard.press("Tab");
  await expect(form.locator('[name="leadLocality"]')).toBeFocused();
  await page.keyboard.press("m");
  await expect(form.locator('[name="leadLocality"]')).toHaveValue("Mira Road");
  await page.keyboard.press("Tab");
  await expect(form.locator('[name="leadSpace"]')).toBeFocused();
  await page.keyboard.press("r");
  await expect(form.locator('[name="leadSpace"]')).toHaveValue("Home / Flat");
  await page.keyboard.press("Tab");
  await expect(form.locator('[name="leadService"]')).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(form.locator('[name="leadRequirement"]')).toBeFocused();
  await page.keyboard.type("Keyboard enquiry");
  await page.keyboard.press("Tab");
  await expect(form.locator('[name="leadConsent"]')).toBeFocused();
  await page.keyboard.press("Space");
  await expect(form.locator('[name="leadConsent"]')).toBeChecked();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(form.locator('[type="submit"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(form.locator(".lead-feedback")).toContainText("Your enquiry is ready");
});
