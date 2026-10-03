import { test, expect } from "@playwright/test";

const route = "/digital-seva-kendra";
const visibleCards = (page) => page.locator("#services-grid .seva-service-card:not([hidden])");
const message = async (locator) =>
  new URL(await locator.getAttribute("href")).searchParams.get("text");

async function fillEnquiry(page) {
  await page.locator("#request-service-select").selectOption("1");
  await page.locator("#request-name").fill("QA Customer");
  await page.locator("#request-phone").fill("+91 98765 43210");
  await page.locator("#request-notes").fill("Please check my documents & explain the fees.");
}

test("Seva loads cleanly with consistent catalogue, contacts, fees, and metadata", async ({
  page
}) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(route);
  await expect(visibleCards(page)).toHaveCount(16);
  expect(errors).toEqual([]);
  await expect(page.locator("#hero-search-clear")).toBeHidden();
  await expect(page.locator("#seva-search-clear")).toBeHidden();
  expect(await page.locator('link[rel="canonical"]').getAttribute("href")).not.toContain(
    "__SITE_URL__"
  );
  await expect(page.locator("#services-title")).toContainText("153");
  await expect(page.locator("#reviews")).not.toContainText(/4\.9|180\+|Verified Client/);
  const result = await page.evaluate(() => {
    const data = JSON.parse(document.getElementById("seva-data").textContent);
    const options = [...document.querySelectorAll("#request-service-select option")];
    return {
      count: data.services.length,
      mismatches: data.services
        .filter((s) => {
          const card = document.querySelector(`#services-grid [data-id="${s.id}"]`);
          const text = new URL(card.querySelector('a[href*="wa.me"]').href).searchParams.get(
            "text"
          );
          return (
            !options.some(
              (o) =>
                o.value === s.id &&
                o.textContent.replace(/\s+/g, " ").trim() === `${s.name} (₹${s.charge})`
            ) ||
            !text.includes(s.name) ||
            !text.includes(`₹${s.charge}`) ||
            !card
              .querySelector(".seva-statutory-note")
              .textContent.replace(/\s+/g, " ")
              .includes(s.official_fee)
          );
        })
        .map((s) => s.id),
      phones: [
        ...new Set(
          [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute("href"))
        )
      ],
      emails: [
        ...new Set(
          [...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute("href"))
        )
      ]
    };
  });
  expect(result).toEqual({
    count: 153,
    mismatches: [],
    phones: ["tel:+918369704457"],
    emails: ["mailto:sarathidigitalsevakendra@gmail.com"]
  });
});

test("directory searches, filters, paginates, sorts and restores its original order", async ({
  page
}) => {
  await page.goto(route);
  const original = await visibleCards(page).evaluateAll((es) => es.map((e) => e.dataset.id));
  await page.locator("#load-more-btn").click();
  await expect(visibleCards(page)).toHaveCount(32);
  await page.locator("#show-all-btn").click();
  await expect(visibleCards(page)).toHaveCount(153);
  await expect(page.locator("#show-all-btn")).toBeHidden();
  for (const sort of ["price-asc", "price-desc", "name-asc"]) {
    await page.locator("#seva-sort").selectOption(sort);
    const values = await visibleCards(page).evaluateAll(
      (es, sort) =>
        es.map((e) => (sort === "name-asc" ? e.dataset.name : Number(e.dataset.charge))),
      sort
    );
    expect(values).toEqual(
      [...values].sort(
        sort === "name-asc"
          ? (a, b) => a.localeCompare(b)
          : sort === "price-asc"
            ? (a, b) => a - b
            : (a, b) => b - a
      )
    );
  }
  await page.locator("#seva-sort").selectOption("default");
  expect(
    await visibleCards(page).evaluateAll((es) => es.slice(0, 16).map((e) => e.dataset.id))
  ).toEqual(original);
  for (const tab of await page.locator('.seva-tab:not([data-filter="all"])').all()) {
    const category = await tab.getAttribute("data-filter");
    await tab.click();
    expect(
      await visibleCards(page).evaluateAll((es) => [...new Set(es.map((e) => e.dataset.category))])
    ).toEqual([category]);
  }
  await page.locator('.seva-tab[data-filter="all"]').click();
  await page.locator('.seva-chip[data-chip="under300"]').click();
  await page.locator('.seva-quick-pill[data-query="Drug"]').click();
  await expect(page.locator('.seva-chip[data-chip="all"]')).toHaveAttribute("aria-pressed", "true");
  expect(await visibleCards(page).count()).toBeGreaterThan(0);
  await page.locator("#seva-search").fill("zzzz-no-service");
  await expect(visibleCards(page)).toHaveCount(0);
  await expect(page.locator("#no-services-found")).toBeVisible();
  await expect(page.locator("#hero-seva-search")).toHaveValue("zzzz-no-service");
  await page.locator("#seva-search-clear").click();
  await expect(visibleCards(page)).toHaveCount(16);
  await page.locator('.seva-chip[data-chip="printing"]').click();
  await expect(page.locator("#filter-total-count")).toHaveText("20");
});

test("checklists, service preselection, and FAQs remain functional", async ({ page }) => {
  await page.goto(route);
  await page.locator("#popular .seva-btn-details").first().click();
  await page.locator(".seva-doc-cb").first().check();
  await expect(page.locator("#checklist-counter")).toHaveText("1 of 2 documents ready");
  expect(await message(page.locator("#modal-wa-btn"))).toContain("₹250");
  await page.keyboard.press("Escape");
  await expect(page.locator("#seva-detail-modal")).not.toBeVisible();
  await page.locator("#popular .seva-btn-details").first().click();
  await page.locator("#modal-book-btn").click();
  await expect(page.locator("#request-service-select")).toHaveValue("1");
  for (const faq of await page.locator(".seva-faq-item").all()) {
    await faq.locator("summary").click();
    await expect(faq).toHaveAttribute("open", "");
    await faq.locator("summary").click();
    await expect(faq).not.toHaveAttribute("open", "");
  }
});

for (const mode of ["walk-in", "online-wa"]) {
  test(`honest ${mode} enquiry validates and prepares a complete message without saving or sending`, async ({
    page
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem("sarathi_seva_last_request", '{"customerName":"old private record"}')
    );
    await page.goto(route);
    const posts = [];
    page.on("request", (req) => {
      if (req.method() === "POST") posts.push(req.url());
    });
    await page.locator(".seva-submit-btn").click();
    await expect(page.locator("#request-error")).toContainText("choose a service");
    await page.locator("#request-service-select").selectOption("1");
    await page.locator(".seva-submit-btn").click();
    await expect(page.locator("#request-name")).toBeFocused();
    await fillEnquiry(page);
    for (const phone of ["123", "12345678901234567890", "98765abc43210", "0000000000"]) {
      await page.locator("#request-phone").fill(phone);
      await page.locator(".seva-submit-btn").click();
      await expect(page.locator("#request-phone")).toHaveAttribute("aria-invalid", "true");
      await expect(page.locator("#request-confirmation")).toBeHidden();
    }
    await page.locator("#request-phone").fill("+91 98765 43210");
    await page.locator(`input[value="${mode}"]`).check();
    await page.locator(".seva-submit-btn").click();
    await expect(page.locator("#request-confirmation")).toContainText("not a booking confirmation");
    const text = await message(page.locator("#confirm-wa-btn"));
    for (const part of [
      "New PAN application assistance",
      "₹250",
      "QA Customer",
      "+919876543210",
      "Please check my documents & explain the fees.",
      mode === "walk-in" ? "Walk-in" : "Online assistance"
    ])
      expect(text).toContain(part);
    expect(posts).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
    await page.locator("#edit-enquiry-btn").click();
    await expect(page.locator("#request-name")).toHaveValue("QA Customer");
    await page.locator(".seva-submit-btn").click();
    // Selecting another service from a checklist must reopen the form, not leave an old handoff.
    await page.locator("#popular .seva-btn-details").nth(1).click();
    await page.locator("#modal-book-btn").click();
    await expect(page.locator("#seva-request-form")).toBeVisible();
    await expect(page.locator("#request-service-select")).toHaveValue("4");
    await page.locator(".seva-submit-btn").click();
    await page.locator("#new-enquiry-btn").click();
    await expect(page.locator("#request-name")).toHaveValue("");
  });
}

test("blocked storage works; unknown references prepare staff enquiries and never claim progress", async ({
  page
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage disabled");
      }
    })
  );
  await page.goto(route);
  await fillEnquiry(page);
  await page.locator(".seva-submit-btn").click();
  await expect(page.locator("#request-confirmation")).toBeVisible();
  await page.locator("#tab-btn-track").click();
  await page.locator("#track-submit-btn").click();
  await expect(page.locator("#track-error")).toBeVisible();
  await page.locator("#track-id-input").fill("NOT-A-REAL-ID");
  await page.locator("#track-id-input").press("Enter");
  await expect(page.locator("#tracker-display")).toContainText("our team will check");
  expect(await message(page.locator("#tracker-wa-help"))).toContain("NOT-A-REAL-ID");
  await expect(page.locator("#panel-track")).not.toContainText(
    /Documents Verified|Portal Filing in Progress/
  );
  await page.locator("#track-id-input").fill("another-reference");
  await expect(page.locator("#tracker-display")).toBeHidden();
});

for (const width of [320, 390, 768, 920, 1024, 1280, 1440]) {
  test(`Seva navigation and enquiry controls fit and work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    for (const id of [
      "popular",
      "services",
      "packages",
      "request-track",
      "reviews",
      "contact",
      "faq"
    ]) {
      if (width < 1260) {
        await page.locator(".seva-mobile-menu summary").click();
        await page.locator(`.seva-mobile-menu a[href="#${id}"]`).click();
        await expect(page.locator(".seva-mobile-menu")).not.toHaveAttribute("open", "");
      } else {
        await page.locator(`.header-nav a[href="#${id}"]`).click();
      }
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      expect(
        await page.locator(`#${id}`).evaluate((e) => Math.round(e.getBoundingClientRect().top))
      ).toBeGreaterThanOrEqual(72);
    }
    await fillEnquiry(page);
    await page.locator(".seva-submit-btn").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.locator("#tab-btn-track").click();
    await page.locator("#track-id-input").fill("STATUS-TEST-123");
    await page.locator("#track-submit-btn").click();
    await expect(page.locator("#tracker-wa-help")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
  });
}

for (const [date, text] of [
  ["2026-10-03T15:30:00Z", "Opens Monday"],
  ["2026-10-04T04:30:00Z", "Sunday by prior appointment"],
  ["2026-10-05T04:00:00Z", "Open Now"],
  ["2026-10-05T15:00:00Z", "Opens Tomorrow"]
]) {
  test(`IST hours at ${date}`, async ({ page }) => {
    await page.clock.install({ time: new Date(date) });
    await page.goto(route);
    await expect(page.locator("#live-centre-status")).toContainText(text);
  });
}

test("without JavaScript, the form offers a contact fallback and cannot claim submission", async ({
  browser
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(new URL(route, test.info().project.use.baseURL).href);
  await expect(page.locator(".seva-submit-btn")).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "contact us on WhatsApp", exact: true })
  ).toBeVisible();
  await expect(page.locator("#request-confirmation")).toBeHidden();
  await context.close();
});
