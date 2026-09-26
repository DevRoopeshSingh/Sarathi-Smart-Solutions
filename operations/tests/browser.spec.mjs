import { expect, test } from "@playwright/test";
import pg from "pg";
import { fixtureTotp } from "./totp-fixture.mjs";

async function database(work) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_MIGRATION_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function signIn(page) {
  await database((client) => client.query("DELETE FROM sarathi.auth_ratelimits"));
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Email address" }).fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill(process.env.OPERATIONS_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("administrator enrolls an authenticator and completes a two-step sign-in", async ({
  page
}) => {
  await signIn(page);
  try {
    await page.goto("/admin/security");
    await page
      .getByLabel("Current password", { exact: true })
      .fill(process.env.OPERATIONS_TEST_PASSWORD);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("I saved my recovery codes", { exact: true })).toBeVisible();
    const secret = await page.locator("code").first().textContent();
    const uri = `otpauth://totp/test?secret=${secret}`;
    await page.getByLabel("I saved my recovery codes", { exact: true }).check();
    await page.getByLabel("Authenticator code", { exact: true }).fill(fixtureTotp(uri));
    await page.getByRole("button", { name: "Verify & enable", exact: true }).click();
    await expect(
      page.getByText("Authenticator enabled. Future sign-ins require a code.")
    ).toBeVisible();
    await page.context().clearCookies();
    await page.goto("/admin/login");
    await page.getByLabel("Email address", { exact: true }).fill("admin@example.test");
    await page.getByLabel("Password", { exact: true }).fill(process.env.OPERATIONS_TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByLabel("Authenticator code", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.getByLabel("Authenticator code", { exact: true }).fill(fixtureTotp(uri));
    await page.getByRole("button", { name: "Verify & sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/security");
    await page
      .getByLabel("Current password", { exact: true })
      .fill(process.env.OPERATIONS_TEST_PASSWORD);
    await page.getByLabel("Security action", { exact: true }).selectOption("disable");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Authenticator disabled.", { exact: true })).toBeVisible();
  } finally {
    await database(async (client) => {
      await client.query(
        "DELETE FROM sarathi.auth_two_factors WHERE user_id=(SELECT id FROM sarathi.auth_users WHERE email='admin@example.test')"
      );
      await client.query(
        "UPDATE sarathi.auth_users SET two_factor_enabled=false WHERE email='admin@example.test'"
      );
      await client.query("DELETE FROM sarathi.auth_ratelimits");
    });
  }
});

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
  const counts = await database(
    async (client) =>
      (
        await client.query(`SELECT
    (SELECT count(*) FROM sarathi.leads) AS leads,
    (SELECT count(*) FROM sarathi.projects) AS projects,
    (SELECT count(*) FROM sarathi.quotations) AS quotations`)
      ).rows[0]
  );
  await expect(page.locator(".metric dd")).toHaveText([
    counts.leads,
    counts.projects,
    counts.quotations
  ]);
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );

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

test("business writes persist and rejected status changes never look successful", async ({
  page
}, testInfo) => {
  await signIn(page);
  const name = `Browser customer ${testInfo.project.name}`;
  const leadName = `Browser lead ${testInfo.project.name}`;
  const projectName = `Browser project ${testInfo.project.name}`;
  await page.goto("/admin/customers?new=1");
  await page.getByLabel("Full Name / Business Name *", { exact: true }).fill(name);
  await page.getByLabel("Mobile Number *", { exact: true }).fill("9999999999");
  await page.getByRole("button", { name: "Save Customer", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.goto("/admin/leads?new=1");
  await page.getByLabel("Customer / Contact Name *", { exact: true }).fill(leadName);
  await page.getByLabel("Mobile Phone Number *", { exact: true }).fill("9999999999");
  await page.getByLabel("Service Requested *", { exact: true }).fill("CCTV");
  await page.getByRole("button", { name: "Save Lead", exact: true }).click();
  const status = page.getByLabel(`Update status for ${leadName}`, { exact: true });
  await expect(status).toHaveValue("NEW");
  // Reject the actual server write, exercising error projection and client handling.
  await database((client) =>
    client.query(`CREATE OR REPLACE FUNCTION sarathi.browser_reject_lead()
    RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIVATE test driver detail'; END $$;
    CREATE TRIGGER browser_reject_lead BEFORE UPDATE ON sarathi.leads
    FOR EACH ROW EXECUTE FUNCTION sarathi.browser_reject_lead()`)
  );
  try {
    await status.selectOption("CONTACTED");
    await expect(page.locator(".form-error-banner[role='alert']")).toContainText(
      "Unable to save this change."
    );
    await expect(status).toHaveValue("NEW");
    await expect(page.locator("body")).not.toContainText("PRIVATE test driver detail");
  } finally {
    await database((client) =>
      client.query(
        "DROP TRIGGER browser_reject_lead ON sarathi.leads; DROP FUNCTION sarathi.browser_reject_lead()"
      )
    );
  }
  await status.selectOption("CONTACTED");
  await expect(status).toHaveValue("CONTACTED");
  await page.reload();
  await expect(status).toHaveValue("CONTACTED");
  const row = page.getByRole("row").filter({ hasText: leadName });
  await row.getByRole("button", { name: "Convert to Project →", exact: true }).click();
  await page
    .getByLabel("Assign to Customer *", { exact: true })
    .selectOption({ label: `${name} (9999999999)` });
  await page.getByLabel("Project Title *", { exact: true }).fill(projectName);
  await page.getByLabel("Site Address *", { exact: true }).fill("Mumbai");
  await page.getByRole("button", { name: "Confirm & Create Project", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/projects$/);
  // Select by accessible name as desktop and mobile variants share the same label.
  const projectStage = page.locator(
    `select[aria-label="Update operational stage for project ${projectName}"]:visible`
  );
  await expect(projectStage).toHaveValue("SURVEY_PENDING");
  await projectStage.selectOption("COMPLETED");
  const dialog = page.getByRole("dialog", { name: "Record a stage change" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Reason for this change *", { exact: true })
    .fill("Existing installation handed over");
  await dialog.getByRole("button", { name: "Save stage & reason", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(projectStage).toHaveValue("COMPLETED");
  await page.reload();
  await expect(projectStage).toHaveValue("COMPLETED");
  const history = await database(
    async (client) =>
      (
        await client.query(
          `SELECT h.reason FROM sarathi.status_history h
    JOIN sarathi.projects p ON p.id=h.project_id WHERE p.name=$1 ORDER BY h.id DESC LIMIT 1`,
          [projectName]
        )
      ).rows[0]
  );
  expect(history.reason).toBe("Existing installation handed over");
});
