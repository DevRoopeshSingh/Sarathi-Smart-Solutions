import { expect, test } from "@playwright/test";
import pg from "pg";
import { fixtureTotp } from "./totp-fixture.mjs";
import { readFile } from "node:fs/promises";

async function database(work) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_MIGRATION_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function signIn(page, email = "admin@example.test") {
  await database((client) => client.query("DELETE FROM sarathi.auth_ratelimits"));
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(process.env.OPERATIONS_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("payment receipt, private PDF, advance allocation and refund work on desktop/mobile", async ({
  page
}, testInfo) => {
  await signIn(page);
  const project = await database(
    async (client) =>
      (await client.query("SELECT id::text FROM sarathi.projects WHERE name='Payment QA project'"))
        .rows[0]
  );
  await page.goto("/admin/payments/new?projectId=" + project.id);
  const receipt = page.getByRole("region", { name: "Record receipt" });
  await receipt.getByLabel("Amount (INR)", { exact: true }).fill("7.03");
  await receipt.getByLabel("Method", { exact: true }).selectOption("UPI");
  await receipt
    .getByLabel("Transaction reference", { exact: false })
    .fill("UI-PAYMENT-" + testInfo.project.name);
  await receipt.getByLabel("I confirm this records money already received.").check();
  await receipt.getByRole("button", { name: "Save receipt", exact: true }).dblclick();
  await expect(page).toHaveURL(/\/admin\/payments\/\d+$/);
  const receiptId = new URL(page.url()).pathname.split("/").at(-1);
  const number = await page.locator("h1").innerText();
  expect(number).toMatch(/^SAR-RCPT/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: `/private/tmp/sarathi-payment-receipt-${testInfo.project.name}.png`,
    fullPage: true
  });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download private receipt PDF" }).click();
  const download = await downloaded;
  expect((await readFile(await download.path())).subarray(0, 5).toString()).toBe("%PDF-");
  const allocate = page.getByRole("region", { name: "Allocate advance" });
  await allocate.getByLabel("Amount to allocate (INR)").fill("3.01");
  await allocate.getByRole("button", { name: "Allocate advance", exact: true }).click();
  await expect(page.getByText("This receipt:", { exact: false })).toContainText("allocated ₹3.01");
  const refund = page.getByRole("region", { name: "Record refund" });
  await refund.getByLabel("Amount (INR)", { exact: true }).fill("5.02");
  await refund
    .getByLabel("Refund reason", { exact: false })
    .fill("Customer refund already completed");
  await refund.getByLabel("I confirm this records money already refunded.").check();
  await refund.getByRole("button", { name: "Save refund record", exact: true }).click();
  await expect(page.locator("h1")).toContainText("SAR-RFND");
  await expect(page.getByRole("heading", { name: "₹5.02 refunded" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: `/private/tmp/sarathi-payment-refund-${testInfo.project.name}.png`,
    fullPage: true
  });
  await page.getByRole("link", { name: "Original receipt", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/admin/payments/" + receiptId + "$"));
  await expect(page.getByText("This receipt:", { exact: false })).toContainText("allocated ₹2.01");
  const correction = page.getByRole("region", { name: "Record refund" });
  await correction.getByLabel("Entry type").selectOption("REVERSAL");
  await correction.getByLabel("Amount (INR)", { exact: true }).fill("0.01");
  await correction
    .getByLabel("Transaction reference", { exact: false })
    .fill("UI-CORRECTION-" + testInfo.project.name);
  await correction
    .getByLabel("Correction reason", { exact: false })
    .fill("Incorrect one-paisa receipt entry approved for reversal");
  await correction
    .getByLabel("I confirm this reverses an incorrect receipt; no money is moved.")
    .check();
  await correction.getByRole("button", { name: "Save correction record", exact: true }).click();
  await expect(page.locator("h1")).toContainText("SAR-ADJ");
  await expect(page.getByRole("heading", { name: "₹0.01 receipt correction" })).toBeVisible();
  const result = await database(
    async (client) =>
      (
        await client.query("SELECT count(*)::int AS n FROM sarathi.payments WHERE reference=$1", [
          "UI-PAYMENT-" + testInfo.project.name
        ])
      ).rows[0]
  );
  expect(result.n).toBe(1);
});

test("interrupted payment response recovers the stored receipt after a page reload", async ({
  page
}, testInfo) => {
  await signIn(page);
  const project = await database(
    async (client) =>
      (await client.query("SELECT id::text FROM sarathi.projects WHERE name='Payment QA project'"))
        .rows[0]
  );
  const path = "/admin/payments/new?projectId=" + project.id;
  await page.goto(path);
  await page.route("**/admin/payments/new?projectId=" + project.id, async (route) => {
    if (route.request().method() === "POST") {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  const form = page.getByRole("region", { name: "Record receipt" });
  await form.getByLabel("Amount (INR)", { exact: true }).fill("1.11");
  await form.getByLabel("Method", { exact: true }).selectOption("UPI");
  await form
    .getByLabel("Transaction reference", { exact: false })
    .fill("INTERRUPTED-" + testInfo.project.name);
  await form.getByLabel("I confirm this records money already received.").check();
  await form.getByRole("button", { name: "Save receipt", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("interrupted");
  await page.unroute("**/admin/payments/new?projectId=" + project.id);
  await page.reload();
  await expect(page).toHaveURL(/\/admin\/payments\/\d+$/);
  const count = await database(
    async (client) =>
      (
        await client.query("SELECT count(*)::int AS n FROM sarathi.payments WHERE reference=$1", [
          "INTERRUPTED-" + testInfo.project.name
        ])
      ).rows[0]
  );
  expect(count.n).toBe(1);
  const receiptId = new URL(page.url()).pathname.split("/").at(-1),
    detailPath = "**/admin/payments/" + receiptId;
  await page.route(detailPath, async (route) => {
    if (route.request().method() === "POST") {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  const allocation = page.getByRole("region", { name: "Allocate advance" });
  await allocation.getByLabel("Amount to allocate (INR)").fill("0.20");
  await allocation.getByRole("button", { name: "Allocate advance", exact: true }).click();
  await expect(allocation.getByRole("alert")).toContainText("Unable to confirm");
  await page.unroute(detailPath);
  await page.reload();
  await expect(
    page.getByText("The previous allocation was saved.", { exact: false })
  ).toBeVisible();
  await expect(page.getByText("This receipt:", { exact: false })).toContainText("allocated ₹0.20");
  const allocated = await database(
    async (client) =>
      (
        await client.query(
          "SELECT count(*)::int AS n FROM sarathi.payment_allocations WHERE receipt_id=$1 AND amount=0.20",
          [receiptId]
        )
      ).rows[0]
  );
  expect(allocated.n).toBe(1);
});
test("payment write controls respect viewer and operator membership authorization", async ({
  page
}) => {
  await signIn(page, "operator@example.test");
  await page.goto("/admin/payments");
  await expect(page.getByRole("link", { name: "Record receipt", exact: true })).toHaveCount(0);
  await page.goto("/admin/payments/new");
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await page.context().clearCookies();
  await signIn(page, "viewer@example.test");
  await page.goto("/admin/payments");
  await expect(page).toHaveURL(/\/admin$/);
});

test("first-login introduction persists per account and can be replayed", async ({
  page
}, testInfo) => {
  await database((client) =>
    client.query(
      "UPDATE sarathi.users SET onboarding_completed_at=NULL WHERE identity_subject=(SELECT id FROM sarathi.auth_users WHERE email='newcomer@example.test')"
    )
  );
  await signIn(page, "newcomer@example.test");
  const tour = page.getByRole("dialog");
  await expect(tour.getByRole("heading", { name: "Welcome to Sarathi" })).toBeVisible();
  await page.screenshot({
    path: `/tmp/sarathi-workflow-tour-${testInfo.project.name}.png`,
    fullPage: true
  });
  await page.keyboard.press("Tab");
  expect(await tour.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour.getByRole("heading", { name: "Start with the lead" })).toBeVisible();
  await tour.getByRole("button", { name: "Back", exact: true }).click();
  await page.route("**/api/admin/onboarding", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } })
  );
  await tour.getByRole("button", { name: "Skip introduction" }).click();
  await expect(tour.getByRole("alert")).toContainText("couldn’t save");
  await expect(tour).toBeVisible();
  await page.unroute("**/api/admin/onboarding");
  for (let step = 0; step < 3; step++)
    await tour.getByRole("button", { name: "Next", exact: true }).click();
  await tour.getByRole("button", { name: "Start exploring" }).click();
  await expect(tour).not.toBeVisible();
  await page.reload();
  await expect(tour).not.toBeVisible();
  await page.goto("/admin/how-it-works");
  await expect(page.getByRole("heading", { name: "How it works", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Capture an enquiry" })).toHaveCount(0);
  await page.getByRole("button", { name: "Replay introduction" }).click();
  await expect(tour).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tour).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: `/tmp/sarathi-workflow-guide-${testInfo.project.name}.png`,
    fullPage: true
  });
  await page.context().clearCookies();
  await signIn(page, "newcomer@example.test");
  await expect(tour).not.toBeVisible();
});

test("linked detail pages explain stages and show real activity on desktop and mobile", async ({
  page
}, testInfo) => {
  await signIn(page, "operator@example.test");
  const row = await database(
    async (client) =>
      (
        await client.query(
          "SELECT id::text, lead_id::text AS lead FROM sarathi.projects WHERE name='Workflow fixture'"
        )
      ).rows[0]
  );
  await page.goto(`/admin/leads/${row.lead}`);
  await expect(page.getByRole("heading", { name: "Workflow enquiry", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "About Converted", exact: true }).focus();
  await expect(page.getByRole("tooltip")).toContainText("does not mean a quotation was approved");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.getByRole("link", { name: "Continue in linked project" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/projects/${row.id}$`));
  await expect(page.getByRole("region", { name: "Previous and next steps" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Activity timeline" })).toContainText(
    "Survey already completed with the customer"
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: `/tmp/sarathi-workflow-project-${testInfo.project.name}.png`,
    fullPage: true
  });
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(350); // Let the existing colour transition finish for visual review.
  await page.screenshot({
    path: `/tmp/sarathi-workflow-project-dark-${testInfo.project.name}.png`,
    fullPage: true
  });
  await page.getByRole("link", { name: "Quotation v1 · Issued", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Workflow fixture · Quotation v1", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Activity timeline" })).toContainText(
    "Quotation v1 sent"
  );
  await expect(page.getByRole("region", { name: "Previous and next steps" })).toContainText(
    "staff record"
  );
  try {
    await database((client) =>
      client.query(
        "UPDATE sarathi.projects SET on_hold=true,hold_reason='Awaiting customer access' WHERE id=$1",
        [row.id]
      )
    );
    await page.goto(`/admin/projects/${row.id}`);
    await expect(page.getByRole("heading", { name: "On hold — pause progression" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Previous and next steps" })).toContainText(
      "Awaiting customer access"
    );
    await expect(page.getByRole("link", { name: "Manage stage in project list" })).toHaveCount(0);
  } finally {
    await database((client) =>
      client.query("UPDATE sarathi.projects SET on_hold=false,hold_reason=NULL WHERE id=$1", [
        row.id
      ])
    );
  }
});

test("restarting MFA clears the password even after using the visibility toggle", async ({
  page
}) => {
  await page.route("**/api/auth/sign-in/email", (route) =>
    route.fulfill({ status: 200, json: { twoFactorRequired: true } })
  );
  await page.goto("/admin/login");
  await page.getByLabel("Email address", { exact: true }).fill("review@example.test");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("Dummy-review-password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("Dummy-review-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Authenticator code", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start again", exact: true }).click();
  await expect(password).toHaveValue("");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(password).toHaveValue("");
});

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

test("administrator assigns a role to an existing user", async ({ page }) => {
  await signIn(page);
  try {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users & roles" })).toBeVisible();
    const operator = page.getByRole("row").filter({ hasText: "operator@example.test" });
    await operator.getByLabel("Role for Test operator").selectOption("VIEWER");
    await operator.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toContainText("Role updated.");
    const role = await database(async (client) =>
      client.query(
        "SELECT role FROM sarathi.users WHERE identity_subject = (SELECT id FROM sarathi.auth_users WHERE email = 'operator@example.test')"
      )
    );
    expect(role.rows[0].role).toBe("VIEWER");
  } finally {
    await database((client) =>
      client.query(
        "UPDATE sarathi.users SET role = 'OPERATOR' WHERE identity_subject = (SELECT id FROM sarathi.auth_users WHERE email = 'operator@example.test'); UPDATE sarathi.organization_memberships SET role='OPERATOR' WHERE organization_id=1 AND user_id=(SELECT u.id FROM sarathi.users u JOIN sarathi.auth_users a ON a.id=u.identity_subject WHERE a.email='operator@example.test')"
      )
    );
  }
});

test("viewer navigation and pages remain read-only", async ({ page }) => {
  await database((client) => client.query("DELETE FROM sarathi.auth_ratelimits"));
  await page.goto("/admin/login");
  await page.getByLabel("Email address", { exact: true }).fill("viewer@example.test");
  await page.getByLabel("Password", { exact: true }).fill(process.env.OPERATIONS_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('.sidebar-nav a[href="/admin/payments"]')).toHaveCount(0);
  await expect(page.locator('.sidebar-nav a[href="/admin/security"]')).toHaveCount(0);
  await expect(page.locator('.sidebar-nav a[href="/admin/users"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New Lead" })).toHaveCount(0);

  await page.goto("/admin/leads?new=1");
  await expect(page.getByRole("heading", { name: "Leads & Enquiries" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add New Lead" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /Update status for/ })).toHaveCount(0);

  await page.goto("/admin/payments");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/security");
  await expect(page).toHaveURL(/\/admin$/);
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
    (SELECT count(*) FROM sarathi.leads WHERE organization_id=(SELECT id FROM sarathi.organizations WHERE slug='sarathi')) AS leads,
    (SELECT count(*) FROM sarathi.projects WHERE organization_id=(SELECT id FROM sarathi.organizations WHERE slug='sarathi')) AS projects,
    (SELECT count(*) FROM sarathi.quotations WHERE organization_id=(SELECT id FROM sarathi.organizations WHERE slug='sarathi')) AS quotations`)
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
  await expect(page.getByRole("alert", { name: "Possible existing customers" })).toBeVisible();
  await page.getByRole("button", { name: "Create separate customer", exact: true }).click();
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
  await expect(page.locator('input[name="serviceTypes"][value="cctv"]')).toBeChecked();
  await page.locator('input[name="serviceTypes"][value="cctv"]').uncheck();
  await page.locator('input[name="serviceTypes"][value="network"]').check();
  await page.locator('input[name="serviceTypes"][value="biometric"]').check();
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
  const conversion = await database(
    async (client) =>
      (
        await client.query(
          `SELECT p.service_types, p.lead_id::text, p.customer_id::text AS project_customer,
          l.status AS lead_status, l.contact_name AS lead_name, l.customer_id::text AS lead_customer,
          c.name AS customer_name
          FROM sarathi.projects p
          JOIN sarathi.leads l ON l.id=p.lead_id
          JOIN sarathi.customers c ON c.id=p.customer_id WHERE p.name=$1`,
          [projectName]
        )
      ).rows[0]
  );
  expect(conversion.service_types).toEqual(["network", "biometric"]);
  expect(conversion.lead_id).toMatch(/^\d+$/);
  expect(conversion.lead_status).toBe("CONVERTED");
  expect(conversion.lead_name).toBe(leadName);
  expect(conversion.customer_name).toBe(name);
  expect(conversion.lead_customer).toBe(conversion.project_customer);
  await page.goto(`/admin/leads/${conversion.lead_id}`);
  await expect(page.getByRole("heading", { name: leadName, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue in linked project" })).toBeVisible();
});

test("operator chooses project services and empty selections never create a record", async ({
  page
}, testInfo) => {
  const customerName = `Service selector customer ${testInfo.project.name}`;
  const projectName = `Service selector project ${testInfo.project.name}`;
  const customer = await database(
    async (client) =>
      (
        await client.query(
          "INSERT INTO sarathi.customers(name,phone) VALUES($1,'9999999999') RETURNING id::text",
          [customerName]
        )
      ).rows[0]
  );
  await signIn(page, "operator@example.test");
  await page.goto("/admin/projects?new=1");
  const dialog = page.getByRole("dialog", { name: "Create New Project", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Select Customer *", { exact: true }).selectOption(customer.id);
  await dialog.getByLabel("Project Name / Title *", { exact: true }).fill(projectName);
  await dialog.getByLabel("Site Address *", { exact: true }).fill("Mira Road, Mumbai");
  const cctv = dialog.locator('input[name="serviceTypes"][value="cctv"]');
  await expect(cctv).toBeChecked();
  await expect(dialog.locator('input[name="serviceTypes"]:checked')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: `/tmp/sarathi-project-service-selector-${testInfo.project.name}.png`,
    fullPage: true
  });
  await cctv.uncheck();
  await dialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/service/i);
  await expect(dialog).toBeVisible();
  const rejected = await database((client) =>
    client.query("SELECT id FROM sarathi.projects WHERE name=$1", [projectName])
  );
  expect(rejected.rowCount).toBe(0);
  await dialog.locator('input[name="serviceTypes"][value="network"]').check();
  await dialog.locator('input[name="serviceTypes"][value="biometric"]').check();
  await dialog.getByRole("button", { name: "Save Project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: projectName, exact: true })).toBeVisible();
  const saved = await database(
    async (client) =>
      (
        await client.query(
          `SELECT id::text, customer_id::text, lead_id::text, service_types,
          operational_status FROM sarathi.projects WHERE name=$1`,
          [projectName]
        )
      ).rows[0]
  );
  expect(saved.customer_id).toBe(customer.id);
  expect(saved.lead_id).toBeNull();
  expect(saved.service_types).toEqual(["network", "biometric"]);
  expect(saved.operational_status).toBe("SURVEY_PENDING");
  await page.getByRole("link", { name: projectName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/projects/${saved.id}$`));
  await expect(page.getByRole("heading", { name: projectName, exact: true })).toBeVisible();
  const details = page.getByRole("region", { name: "Record details", exact: true });
  await expect(details).toContainText("Wi‑Fi & networking");
  await expect(details).toContainText("Biometric attendance / access control");
});

test("customer V2 creates, warns about duplicates, edits, and displays scoped profile history", async ({
  page
}, testInfo) => {
  await signIn(page, "operator@example.test");
  const name = `Customer profile browser ${testInfo.project.name}`;
  const phone = testInfo.project.name === "desktop" ? "9876012301" : "9876012302";
  await page.goto("/admin/customers?new=1");
  const dialog = page.getByRole("dialog", { name: "Create Customer Profile" });
  await dialog.getByLabel("Full Name / Business Name *", { exact: true }).fill(name);
  await dialog.getByLabel("Mobile Number *", { exact: true }).fill("abc");
  await dialog.getByRole("button", { name: "Save Customer", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("valid phone");
  await dialog.getByLabel("Mobile Number *", { exact: true }).fill(phone);
  await dialog.getByRole("button", { name: "Save Customer", exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  // Desktop and mobile names share a normalized prefix, so the second run may
  // legitimately warn about a similar name even though the phone is different.
  await expect(async () => {
    expect(
      (await dialog.count()) === 0 ||
        (await dialog.getByRole("alert", { name: "Possible existing customers" }).isVisible())
    ).toBe(true);
  }).toPass();
  if (await dialog.count()) {
    await dialog.getByRole("button", { name: "Create separate customer", exact: true }).click();
    await dialog.getByRole("button", { name: "Save Customer", exact: true }).click();
  }
  await expect(dialog).toHaveCount(0);
  const created = await database((client) =>
    client.query("SELECT count(*)::int AS count FROM sarathi.customers WHERE name=$1", [name])
  );
  expect(created.rows[0].count).toBe(1);
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Customer information" })).toContainText(phone);
  await page.getByRole("button", { name: "Edit Customer", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit Customer Profile" });
  await expect(editor.getByLabel("Full Name / Business Name *", { exact: true })).toHaveValue(name);
  await expect(editor.getByLabel("Mobile Number *", { exact: true })).toHaveValue(phone);
  await editor.getByLabel("Email Address (Optional)", { exact: true }).fill("edited@example.test");
  await editor
    .getByLabel("Address / Locality (Optional)", { exact: true })
    .fill("Updated Mumbai address");
  await editor.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Customer information" })).toContainText(
    "edited@example.test"
  );
  await page.getByRole("link", { name: "Recent activity", exact: true }).click();
  await expect(page.getByRole("region", { name: "activity records" })).toContainText(
    "Customer details updated"
  );
  await expect(page.getByRole("region", { name: "activity records" })).toContainText(
    "Test operator"
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: `/tmp/sarathi-customer-profile-${testInfo.project.name}.png`,
    fullPage: true
  });
  await page.goto("/admin/customers?new=1");
  await dialog
    .getByLabel("Full Name / Business Name *", { exact: true })
    .fill("Different person at shared contact");
  await dialog.getByLabel("Mobile Number *", { exact: true }).fill(`+91 ${phone}`);
  await dialog.getByRole("button", { name: "Save Customer", exact: true }).click();
  await expect(dialog.getByRole("alert", { name: "Possible existing customers" })).toContainText(
    "Matching phone"
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const found = await database((client) =>
    client.query(
      "SELECT count(*)::int AS count FROM sarathi.customers WHERE name='Different person at shared contact'"
    )
  );
  expect(found.rows[0].count).toBe(0);
});

test("customer V2 viewer profiles hide editing and payments", async ({ page }) => {
  const fixture = await database((client) =>
    client.query(
      "SELECT id::text FROM sarathi.customers WHERE name LIKE 'Customer profile browser %' ORDER BY id DESC LIMIT 1"
    )
  );
  await signIn(page, "viewer@example.test");
  await page.goto(`/admin/customers/${fixture.rows[0].id}`);
  await expect(page.getByRole("button", { name: "Edit Customer", exact: true })).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "Customer records" })
      .getByRole("link", { name: "Payments", exact: true })
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Recent activity", exact: true }).click();
  await expect(page.getByRole("region", { name: "activity records" })).toContainText(
    "Customer details updated"
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});

async function prepareQuote(page, label) {
  const customer = await database(
    async (client) =>
      (
        await client.query(
          "INSERT INTO sarathi.customers(name,phone) VALUES($1,'9999999999') RETURNING id::text",
          [label]
        )
      ).rows[0]
  );
  await page.goto("/admin/quotes/new");
  await page.getByLabel("Search customer directory").fill(label);
  await expect(
    page.getByRole("option", { name: label + " (9999999999)", exact: true })
  ).toBeAttached();
  await page.getByLabel("Customer", { exact: true }).selectOption(customer.id);
  await page.getByLabel("Division", { exact: true }).selectOption({ label: "Smart Solutions" });
  await page.getByLabel("Quotation title").fill(label);
  await page.getByLabel("Description 1", { exact: true }).fill("CCTV supply / सीसीटीवी");
  await page.getByLabel("Quantity 1", { exact: true }).fill("2.500");
  await page.getByLabel("Rate (INR) 1", { exact: true }).fill("100.01");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Description 2", { exact: true }).fill("Installation and testing");
  await page.getByLabel("Rate (INR) 2", { exact: true }).fill("50");
  await page.getByLabel("Overall discount (INR)").fill("0.01");
  await page.getByLabel("Valid until", { exact: true }).fill("2099-12-31");
  await page
    .getByLabel("Terms and conditions")
    .fill("Delivery by agreement. This quote does not record payment.");
}
test("quotation drafts, PDFs, staff acceptance and revision rejection work at the counter", async ({
  page
}, testInfo) => {
  await signIn(page, "operator@example.test");
  const label = "Counter quotation " + testInfo.project.name;
  await prepareQuote(page, label);
  await expect(page.getByLabel("Tax treatment")).toHaveValue("NONE");
  await expect(page.getByLabel("Tax treatment").locator("option")).toHaveCount(1);
  await page.getByRole("button", { name: "Calculate totals", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("₹300.02");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({
    path: "/tmp/sarathi-quotation-editor-" + testInfo.project.name + ".png",
    fullPage: true
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9]+$/);
  const original = page.url();
  await expect(page.getByRole("region", { name: "Quotation items" })).toContainText(
    "Saved total: ₹300.02"
  );
  await page.getByRole("link", { name: "Edit draft", exact: true }).click();
  await page.getByLabel("Rate (INR) 1", { exact: true }).fill("120");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(original);
  await expect(page.getByRole("region", { name: "Quotation items" })).toContainText("₹349.99");
  await page.getByLabel("I have reviewed the saved items", { exact: false }).check();
  await page.getByRole("button", { name: "Issue quotation", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download issued PDF", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit draft", exact: true })).toHaveCount(0);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download issued PDF", exact: true }).click();
  const downloaded = await downloadEvent;
  expect(downloaded.suggestedFilename()).toMatch(/^SAR-SMART-.*\.pdf$/);
  expect(await downloaded.failure()).toBeNull();
  await expect(page).toHaveURL(original);
  await page
    .getByLabel("Customer communication / decision reference")
    .fill("Customer accepted by phone; recorded at the counter.");
  await page.getByLabel("I confirm this is a staff record").check();
  await page.getByRole("button", { name: "Record acceptance", exact: true }).click();
  await expect(page.getByRole("region", { name: "Quotation audit history" })).toContainText(
    "ACCEPTED STAFF"
  );
  await page.getByRole("button", { name: "Create revision draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9]+\/edit$/);
  await page.getByLabel("Quotation title").fill(label + " revised");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9]+$/);
  await page.getByLabel("I have reviewed the saved items", { exact: false }).check();
  await page.getByRole("button", { name: "Issue quotation", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download issued PDF", exact: true })).toBeVisible();
  await page
    .getByLabel("Customer communication / decision reference")
    .fill("Customer declined the revised scope.");
  await page.getByLabel("I confirm this is a staff record").check();
  await page.getByRole("button", { name: "Record rejection", exact: true }).click();
  await expect(page.getByRole("region", { name: "Quotation audit history" })).toContainText(
    "REJECTED STAFF"
  );
  await page.goto(original);
  await expect(page.getByRole("region", { name: "Quotation items" })).toContainText("Accepted");
  await page.goto("/admin/quotes");
  await page.getByLabel("Quotation status", { exact: true }).selectOption("APPROVED");
  await page.getByRole("searchbox", { name: "Search records", exact: true }).fill(label);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("Accepted");
});
test("quotation stale draft saves keep the first staff member's edit", async ({
  page,
  context
}, testInfo) => {
  await signIn(page);
  await prepareQuote(page, "Concurrent quote " + testInfo.project.name);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/quotes\/[0-9]+$/);
  const url = page.url() + "/edit";
  await page.goto(url);
  const other = await context.newPage();
  await other.goto(url);
  await expect(other.getByLabel("Quotation title")).toBeVisible();
  await page.getByLabel("Quotation title").fill("First staff update");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).not.toHaveURL(url);
  await other.getByLabel("Quotation title").fill("Stale second update");
  await other.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    other.getByRole("region", { name: "Quotation editor" }).getByRole("alert")
  ).toContainText("draft changed");
  await other.close();
});
test("quotation viewer downloads are authorized and mutation controls are hidden", async ({
  page
}) => {
  await signIn(page, "viewer@example.test");
  await page.goto("/admin/quotes");
  await expect(page.getByRole("link", { name: "Create quotation", exact: true })).toHaveCount(0);
  const row = await database(
    async (client) =>
      (
        await client.query(
          "SELECT id::text FROM sarathi.quotations WHERE tax_mode='NONE' AND status='APPROVED' AND division_id=2 ORDER BY id DESC LIMIT 1"
        )
      ).rows[0]
  );
  await page.goto("/admin/quotes/" + row.id);
  await expect(page.getByRole("link", { name: "Download issued PDF", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create revision draft", exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit draft", exact: true })).toHaveCount(0);
  const response = await page.request.get("/api/admin/quotations/" + row.id + "/pdf");
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.goto("/admin/quotes/new");
  await expect(page.getByRole("heading", { name: "Create quotation", exact: true })).toHaveCount(0);
});
