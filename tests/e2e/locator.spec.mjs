import { test, expect } from "@playwright/test";

const library =
  "https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.15/index.min.js";

async function setBrowserKey(page, key = "") {
  await page.route(/\/$/, async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /(<meta name="google-maps-api-key" content=")[^"]*/,
      `$1${key}`
    );
    await route.fulfill({ response, body });
  });
}

test("location works without a key or Google requests on mobile", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    if (/ajax.googleapis.com|maps.googleapis.com/.test(request.url())) requests.push(request.url());
  });
  await setBrowserKey(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.locator("#location address")).toContainText("RNP Park");
  await expect(page.locator("#load-location-map")).toBeHidden();
  await expect(page.locator("#location-map")).toBeHidden();
  await expect(page.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute(
    "href",
    /query_place_id=ChIJ4Ydlu3av5zsRPe9y8mQmG0Y/
  );
  expect(requests).toEqual([]);
  expect(
    await page.locator("#location").evaluate((el) => el.getBoundingClientRect().right)
  ).toBeLessThanOrEqual(375);
});

test("locator loads only on demand and receives the supplied business location", async ({
  page
}) => {
  await setBrowserKey(page, "AIza-test_key");
  let loads = 0;
  await page.route(library, async (route) => {
    loads++;
    await route.fulfill({
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
      body: `
        export class APILoader { static async importLibrary() {} }
        customElements.define('gmpx-api-loader', class extends HTMLElement {});
        customElements.define('gmpx-store-locator', class extends HTMLElement {
          configureFromQuickBuilder(config) { window.locatorConfiguration = config; }
        });`
    });
  });
  await page.goto("/");
  const button = page.getByRole("button", { name: "Load interactive map" });
  await expect(button).toBeVisible();
  expect(loads).toBe(0);
  await button.click();
  await expect(page.locator("#location-map")).toBeVisible();
  await expect(page.locator("#location-map")).toBeFocused();
  expect(loads).toBe(1);
  const config = await page.evaluate(() => window.locatorConfiguration);
  expect(config.locations[0].coords).toEqual({ lat: 19.3152633, lng: 72.8586247 });
  expect(config.mapOptions.center).toEqual(config.locations[0].coords);
  expect(config.capabilities.input).toBe(false);
  expect(config.capabilities.autocomplete).toBe(false);
  expect(config.capabilities.distanceMatrix).toBe(false);
  await page.evaluate(() => window.gm_authFailure());
  await expect(page.locator("#location-map")).toBeHidden();
  await expect(page.locator("#location-map-status")).toContainText("unavailable");
  await expect(page.getByRole("link", { name: /Open in Google Maps/ })).toBeVisible();
});

test("blocked map library preserves usable location and contact links", async ({ page }) => {
  await setBrowserKey(page, "AIza-test_key");
  await page.route(library, (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Load interactive map" }).click();
  await expect(page.locator("#location-map-status")).toContainText("unavailable");
  await expect(page.locator("#location-map")).toBeHidden();
  await expect(page.getByRole("link", { name: /Open in Google Maps/ })).toBeVisible();
  await expect(page.locator('#location a[href="tel:+918369704457"]')).toBeVisible();
});

test("slow map shows a skeleton only after a request and removes it when ready", async ({
  page
}) => {
  await setBrowserKey(page, "AIza-test_key");
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(library, async (route) => {
    await waiting;
    await route.fulfill({
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
      body: `
        export class APILoader { static async importLibrary() {} }
        customElements.define('gmpx-api-loader', class extends HTMLElement {});
        customElements.define('gmpx-store-locator', class extends HTMLElement {
          configureFromQuickBuilder() {}
        });`
    });
  });
  await page.goto("/");
  await expect(page.locator(".map-loading-placeholder")).toBeHidden();
  await page.getByRole("button", { name: "Load interactive map" }).click();
  await expect(page.locator("#location-map")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".map-loading-placeholder")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open in Google Maps/ })).toBeVisible();
  release();
  await expect(page.locator("#location-map gmpx-store-locator")).toBeVisible();
  await expect(page.locator(".map-loading-placeholder")).toHaveCount(0);
  await expect(page.locator("#location-map")).not.toHaveAttribute("aria-busy");
});
