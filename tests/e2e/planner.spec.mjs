import { test, expect } from "@playwright/test";

test.describe("Sarathi Smart Solutions Website & Planner", () => {
  test("page loads without any console or page errors", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });

  test("loads page with correct title, branding, and accessibility landmarks", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("CCTV Installation in Mira-Bhayandar | Wi‑Fi & Smart Security");

    const brand = page.locator(".brand").first();
    await expect(brand).toBeVisible();
    await expect(brand).toHaveAttribute("aria-label", "Sarathi Smart Solutions home");

    const skipLink = page.locator(".skip-link");
    await expect(skipLink).toHaveAttribute("href", "#planner");

    const progressBar = page.locator('.progress-track[role="progressbar"]');
    await expect(progressBar).toHaveAttribute("aria-valuenow", "1");
    await expect(progressBar).toHaveAttribute("aria-valuetext", "Step 1 of 3: Your space");
  });

  test("renders all core company sections properly", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".hero")).toBeVisible();
    await expect(page.locator(".brands")).toBeVisible();
    await expect(page.locator("#services")).toBeVisible();
    await expect(page.locator("#packages")).toBeVisible();
    await expect(page.locator("#advantages")).toBeVisible();
    await expect(page.locator("#planner")).toBeVisible();
    await expect(page.locator("#faq")).toBeVisible();
    await expect(page.locator(".site-footer")).toBeVisible();
  });

  test("renders responsively at mobile viewport without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(isOverflowing).toBe(false);

    // Verify floating contact bar is visible on mobile
    await expect(page.locator(".floating-contact")).toBeVisible();
  });

  test("completes the 3-step solution planner happy path", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Step 1: Space selection
    const homeRadio = page.locator('input[name="space"][value="Home"]');
    await homeRadio.check({ force: true });
    await page.locator("#nextButton").click();

    // Verify transition to Step 2
    await expect(page.locator("#stepLabel")).toHaveText("Step 2 of 3");
    await expect(page.locator("#stepName")).toHaveText("Your needs");

    // Step 2: Service needs
    const cctvCheckbox = page.locator('input[name="needs"][value="cctv"]');
    const wifiCheckbox = page.locator('input[name="needs"][value="network"]');
    await cctvCheckbox.check({ force: true });
    await wifiCheckbox.check({ force: true });
    await page.locator("#nextButton").click();

    // Verify transition to Step 3
    await expect(page.locator("#stepLabel")).toHaveText("Step 3 of 3");
    await expect(page.locator("#stepName")).toHaveText("Setup size");

    // Step 3: Size selection
    const standardSize = page.locator('input[name="size"][value="Standard"]');
    await standardSize.check({ force: true });
    await page.locator("#nextButton").click();

    // Verify Result display
    const resultSection = page.locator("#result");
    await expect(resultSection).toBeVisible();

    const resultTitle = page.locator("#result-title");
    await expect(resultTitle).toHaveText("Connected Control Bundle");

    const summaryText = page.locator("#summaryText");
    await expect(summaryText).toContainText("Space: Home");
    await expect(summaryText).toContainText("Approx. size: Standard");

    // Verify safe WhatsApp link structure
    const waButton = page.locator("#whatsappButton");
    await expect(waButton).toBeVisible();
    const waHref = await waButton.getAttribute("href");
    expect(waHref).toMatch(/^https:\/\/wa\.me\/918369704457\?text=/);
    expect(waHref).toContain("SARATHI%20SMART%20SOLUTIONS");
  });

  test("enforces step-by-step validation and announces accessible errors", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Step 1: Click Continue without selection
    await page.locator("#nextButton").click();
    const spaceError = page.locator("#spaceError");
    await expect(spaceError).toHaveText("Please choose Home or Business to continue.");

    // Resolve Step 1
    await page.locator('input[name="space"][value="Business"]').check({ force: true });
    await expect(spaceError).toHaveText("");
    await page.locator("#nextButton").click();

    // Step 2: Click Continue without selection
    await page.locator("#nextButton").click();
    const needsError = page.locator("#needsError");
    await expect(needsError).toHaveText("Please select at least one service need.");

    // Resolve Step 2
    await page.locator('input[name="needs"][value="biometric"]').check({ force: true });
    await expect(needsError).toHaveText("");
    await page.locator("#nextButton").click();

    // Step 3: Click Continue without selection
    await page.locator("#nextButton").click();
    const sizeError = page.locator("#sizeError");
    await expect(sizeError).toHaveText("Please choose an approximate setup size.");
  });

  test("preserves user selections during backward and forward navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Step 1: Home
    await page.locator('input[name="space"][value="Home"]').check({ force: true });
    await page.locator("#nextButton").click();

    // Step 2: CCTV
    await page.locator('input[name="needs"][value="cctv"]').check({ force: true });
    await page.locator("#nextButton").click();

    // Step 3: Large
    await page.locator('input[name="size"][value="Large"]').check({ force: true });

    // Navigate back to Step 2
    await page.locator("#backButton").click();
    await expect(page.locator('input[name="needs"][value="cctv"]')).toBeChecked();

    // Navigate back to Step 1
    await page.locator("#backButton").click();
    await expect(page.locator('input[name="space"][value="Home"]')).toBeChecked();

    // Navigate forward to Step 3 again
    await page.locator("#nextButton").click();
    await page.locator("#nextButton").click();

    // Verify Size choice was preserved!
    await expect(page.locator('input[name="size"][value="Large"]')).toBeChecked();
  });

  test("resets the planner when Start again is clicked", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Complete planner
    await page.locator('input[name="space"][value="Home"]').check({ force: true });
    await page.locator("#nextButton").click();
    await page.locator('input[name="needs"][value="cctv"]').check({ force: true });
    await page.locator("#nextButton").click();
    await page.locator('input[name="size"][value="Compact"]').check({ force: true });
    await page.locator("#nextButton").click();

    await expect(page.locator("#result")).toBeVisible();

    // Click Reset
    await page.locator("#resetButton").click();

    await expect(page.locator("#result")).toBeHidden();
    await expect(page.locator("#solutionForm")).toBeVisible();
    await expect(page.locator("#stepLabel")).toHaveText("Step 1 of 3");
    await expect(page.locator('input[name="space"][value="Home"]')).not.toBeChecked();
  });

  test("FAQ accordion opens and closes correctly", async ({ page }) => {
    await page.goto("/");

    const firstFaq = page.locator(".faq-card").first();
    await expect(firstFaq).toHaveAttribute("open", "");
    await expect(firstFaq.locator(".faq-trigger")).toHaveAttribute("aria-expanded", "true");

    const secondFaq = page.locator(".faq-card").nth(1);
    await expect(secondFaq).not.toHaveAttribute("open", "");
    await expect(secondFaq.locator(".faq-trigger")).toHaveAttribute("aria-expanded", "false");

    await secondFaq.locator(".faq-trigger").click();
    await expect(secondFaq).toHaveAttribute("open", "");
    await expect(secondFaq.locator(".faq-trigger")).toHaveAttribute("aria-expanded", "true");
  });
});
