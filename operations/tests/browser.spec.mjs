import { expect, test } from "@playwright/test";

test("administrator signs in, sees live counts and signs out on all viewport sizes", async ({
  page
}, testInfo) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: `/tmp/sarathi-operations-login-${testInfo.project.name}.png`,
    fullPage: true
  });
  await page.getByRole("textbox", { name: "Email address" }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill(process.env.OPERATIONS_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Welcome, Test administrator." })).toBeVisible();
  await expect(page.getByText("admin@example.test", { exact: true })).toBeVisible();
  await expect(page.locator(".metric dd")).toHaveText(["0", "0", "0"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: `/tmp/sarathi-operations-admin-${testInfo.project.name}.png`,
    fullPage: true
  });

  // Verify theme toggle interaction and dark mode persistence
  const themeToggle = page.getByRole("button", { name: /switch to dark theme/i });
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.waitForTimeout(350);
  await page.screenshot({
    path: `/tmp/sarathi-operations-admin-dark-${testInfo.project.name}.png`,
    fullPage: true
  });

  const lightToggle = page.getByRole("button", { name: /switch to light theme/i });
  await expect(lightToggle).toBeVisible();
  await lightToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // Verify Leads page navigation, sidebar offset, and filter spacing
  await page.goto("/admin/leads");
  await expect(page.getByRole("heading", { name: "Leads & Enquiries" })).toBeVisible();
  await expect(page.getByPlaceholder("Search leads by name, phone, or service...")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add New Lead" })).toBeVisible();
  const allFilter = page.getByRole("button", { name: "ALL", exact: true });
  await expect(allFilter).toBeVisible();

  // Verify desktop sidebar reserves width and does not overlap main content
  const sidebarBox = await page.locator(".admin-sidebar").boundingBox();
  const mainBox = await page.locator(".workspace-main").boundingBox();
  if (testInfo.project.name === "desktop" && sidebarBox && mainBox) {
    expect(mainBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width);
  }

  // Verify no horizontal overflow occurs
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.screenshot({
    path: `/tmp/sarathi-operations-leads-${testInfo.project.name}.png`,
    fullPage: true
  });

  // Navigate back to dashboard where SessionControls is present
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Welcome, Test administrator." })).toBeVisible();

  const sessionCookies = await page.context().cookies();
  expect(
    sessionCookies.some(
      (cookie) => cookie.name.includes("session_token") && cookie.httpOnly && cookie.secure
    )
  ).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
