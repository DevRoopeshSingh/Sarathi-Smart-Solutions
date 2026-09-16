import { test, expect } from "@playwright/test";
import { SERVICE_CATALOGUE } from "../../recommendation.mjs";

test("catalogue, planner and enquiry panels expose the same services", async ({ page }) => {
  await page.goto("/");
  const expected = Object.keys(SERVICE_CATALOGUE);
  await expect(page.locator("#serviceGrid article")).toHaveCount(expected.length);
  expect(
    await page
      .locator("#serviceGrid article")
      .evaluateAll((cards) => cards.map((card) => card.dataset.service))
  ).toEqual(expected);
  expect(
    await page
      .locator('#needGrid input[name="needs"]')
      .evaluateAll((inputs) => inputs.map((input) => input.value))
  ).toEqual(expected);
  expect(
    await page
      .locator("#serviceOptions fieldset")
      .evaluateAll((panels) => panels.map((panel) => panel.dataset.service))
  ).toEqual(expected);
});

for (const [id, work, detailField, detail] of [
  ["appliance", "Servicing / deep cleaning", "equipment", "Split AC"],
  ["electrical", "Earthing / distribution board", "notes", "Kitchen power points"],
  ["tv", "TV wall mounting", "wall", "Concrete / brick"],
  ["ev", "New charger installation", "parking", "Housing society parking"],
  ["it", "Server / business IT support", "notes", "Office backups & printer setup"]
]) {
  test(`${id} can be selected from its card and sent as a detailed enquiry`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.locator(`#serviceGrid [data-service="${id}"] a`).click();
    await page.locator('input[name="space"][value="Business"]').locator("..").click();
    await page.locator("#nextButton").click();
    await expect(page.locator(`input[name="needs"][value="${id}"]`)).toBeChecked();
    await page.locator("#nextButton").click();
    await page.locator('input[name="size"][value="Standard"]').locator("..").click();
    await page.locator(`#enquiry-${id}-work`).selectOption(work);
    await page.locator(`#enquiry-${id}-quantity`).fill("2");
    const detailInput = page.locator(`#enquiry-${id}-${detailField}`);
    if (detailField === "notes") await detailInput.fill(detail);
    else await detailInput.selectOption(detail);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
    await page.locator("#nextButton").click();
    await expect(page.locator("#result")).toBeVisible();
    await expect(page.locator("#summaryText")).toContainText(work);
    await expect(page.locator("#summaryText")).toContainText(detail);
    await expect(page.locator("#recommendationList")).toContainText(detail);
    const summary = await page.locator("#summaryText").textContent();
    const url = new URL(await page.locator("#whatsappButton").getAttribute("href"));
    expect(url.searchParams.get("text")).toBe(summary);
    await page.locator("#resetButton").click();
    await expect(page.locator(`#enquiry-${id}-work`)).toHaveValue("");
    await expect(page.locator(`#enquiry-${id}-quantity`)).toHaveValue("");
    await expect(detailInput).toHaveValue("");
    await expect(page.locator(`input[name="needs"][value="${id}"]`)).not.toBeChecked();
  });
}

test("details survive navigation, are excluded on deselection, and support safe copy/share", async ({
  page
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.copiedEnquiry = text;
        }
      },
      configurable: true
    });
    Object.defineProperty(navigator, "share", {
      value: async (data) => {
        window.sharedEnquiry = data.text;
      },
      configurable: true
    });
  });
  await page.goto("/");
  await page.locator('input[name="space"][value="Home"]').locator("..").click();
  await page.locator("#nextButton").click();
  await page.locator('input[name="needs"][value="appliance"]').locator("..").click();
  await page.locator('input[name="needs"][value="tv"]').locator("..").click();
  await page.locator("#nextButton").click();
  await page.locator('input[name="size"][value="Compact"]').locator("..").click();
  await page.locator("#enquiry-appliance-notes").fill("OLD AC DETAILS");
  await page.locator("#enquiry-tv-notes").fill('<img src=x onerror="alert(1)"> & 55 inch TV');
  await page.locator("#enquiry-tv-quantity").fill("0");
  await page.locator("#nextButton").click();
  await expect(page.locator("#sizeError")).not.toBeEmpty();
  await expect(page.locator("#enquiry-tv-quantity")).toBeFocused();
  await page.locator("#enquiry-tv-quantity").fill("1");
  await page.locator("#backButton").click();
  await page.locator('input[name="needs"][value="appliance"]').locator("..").click();
  await page.locator("#nextButton").click();
  await expect(page.locator("#enquiry-appliance-notes")).toBeHidden();
  await expect(page.locator("#enquiry-appliance-notes")).toBeDisabled();
  await page.locator("#backButton").click();
  await page.locator('input[name="needs"][value="appliance"]').locator("..").click();
  await page.locator("#nextButton").click();
  await expect(page.locator("#enquiry-appliance-notes")).toHaveValue("OLD AC DETAILS");
  await page.locator("#backButton").click();
  await page.locator('input[name="needs"][value="appliance"]').locator("..").click();
  await page.locator("#nextButton").click();
  await page.locator("#nextButton").click();
  await expect(page.locator("#summaryText")).not.toContainText("OLD AC DETAILS");
  await expect(page.locator("#summaryText")).toContainText('<img src=x onerror="alert(1)">');
  await expect(page.locator("#result img")).toHaveCount(0);
  const summary = await page.locator("#summaryText").textContent();
  await page.locator("#copyButton").click();
  expect(await page.evaluate(() => window.copiedEnquiry)).toBe(summary);
  await page.locator("#shareButton").click();
  expect(await page.evaluate(() => window.sharedEnquiry)).toBe(summary);
});

test("all services can be combined with optional details left blank", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[name="space"][value="Home"]').locator("..").click();
  await page.locator("#nextButton").click();
  for (const id of Object.keys(SERVICE_CATALOGUE)) {
    await page.locator(`input[name="needs"][value="${id}"]`).locator("..").click();
  }
  await page.locator("#nextButton").click();
  await page.locator('input[name="size"][value="Large"]').locator("..").click();
  await page.locator("#nextButton").click();
  await expect(page.locator("#recommendationList .recommendation-item")).toHaveCount(
    Object.keys(SERVICE_CATALOGUE).length + 1
  );
  for (const entry of Object.values(SERVICE_CATALOGUE)) {
    await expect(page.locator("#summaryText")).toContainText(entry.label);
  }
});
