import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { resolveOrganizationContext } from "../src/server/tenancy";
import { AccessDeniedError } from "../src/server/mutation-errors";

if (process.env.OPERATIONS_TEST_ISOLATED !== "1") throw new Error("Use the isolated harness.");
const owner = new pg.Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, max: 1 });
const runtime = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
after(async () => {
  await runtime.end();
  await owner.end();
});
const organizationId = (
  await owner.query("SELECT id::text FROM sarathi.organizations WHERE slug='sarathi'")
).rows[0].id as string;
const users = (
  await owner.query(`SELECT u.id::text, a.email FROM sarathi.users u
  JOIN sarathi.auth_users a ON a.id=u.identity_subject`)
).rows;
const actorId = (email: string) => users.find((u) => u.email === email)!.id as string;
const operator = actorId("operator@example.test");
const viewer = actorId("viewer@example.test");
const admin = actorId("admin@example.test");
const divisions = (
  await owner.query("SELECT id::text,slug FROM sarathi.divisions WHERE organization_id=$1", [
    organizationId
  ])
).rows;
const smart = divisions.find((d) => d.slug === "smart-solutions")!.id as string;
const digital = divisions.find((d) => d.slug === "digital-seva-kendra")!.id as string;
const other = (
  await owner.query(`INSERT INTO sarathi.organizations(slug,name)
  VALUES ('isolated-other','Other organization') RETURNING id::text`)
).rows[0].id as string;
const foreignDivision = (
  await owner.query(
    `INSERT INTO sarathi.divisions(organization_id,slug,name)
  VALUES ($1,'foreign-division','Foreign division') RETURNING id::text`,
    [other]
  )
).rows[0].id as string;
const context = (actor: string, org = organizationId, division?: string) =>
  resolveOrganizationContext(runtime, actor, org, "dashboard.read", division);
const denied = (error: unknown) => error instanceof AccessDeniedError;

test("initial divisions and explicit fixture memberships preserve roles without elevating users", async () => {
  assert.deepEqual(divisions.map((d) => d.slug).sort(), [
    "ai-business-solutions",
    "digital-seva-kendra",
    "smart-solutions"
  ]);
  assert.equal((await context(admin)).divisions.length, 3);
  assert.deepEqual(
    (await context(operator)).divisions.map((d) => d.id),
    [smart]
  );
  assert.equal((await context(viewer)).permissions.includes("projects.create"), false);
});

test("organization context rejects foreign organizations, unassigned divisions and inactive assignments", async () => {
  await assert.rejects(context(admin, other), denied); // global ADMIN is not a tenant bypass
  await assert.rejects(context(operator, other), denied);
  await assert.rejects(context(operator, organizationId, foreignDivision), denied);
  await assert.rejects(context(operator, organizationId, digital), denied);
  await owner.query(
    `UPDATE sarathi.division_assignments SET active=false WHERE membership_id IN
    (SELECT id FROM sarathi.organization_memberships WHERE user_id=$1 AND organization_id=$2)`,
    [operator, organizationId]
  );
  try {
    await assert.rejects(context(operator, organizationId, smart), denied);
  } finally {
    await owner.query(
      `UPDATE sarathi.division_assignments SET active=true WHERE membership_id IN
    (SELECT id FROM sarathi.organization_memberships WHERE user_id=$1 AND organization_id=$2)`,
      [operator, organizationId]
    );
  }
});

test("revoked organization, membership, user and division access take effect immediately", async () => {
  for (const [sql, params] of [
    ["UPDATE sarathi.organizations SET active=$1 WHERE id=$2", [organizationId]],
    [
      "UPDATE sarathi.organization_memberships SET active=$1 WHERE user_id=$2 AND organization_id=$3",
      [operator, organizationId]
    ],
    ["UPDATE sarathi.users SET active=$1 WHERE id=$2", [operator]],
    ["UPDATE sarathi.divisions SET active=$1 WHERE id=$2", [smart]]
  ] as [string, string[]][]) {
    await owner.query(sql, [false, ...params]);
    try {
      await assert.rejects(context(operator, organizationId, smart), denied);
    } finally {
      await owner.query(sql, [true, ...params]);
    }
  }
});

test("viewer roles cannot elevate to writes through an admin membership", async () => {
  await owner.query(
    "UPDATE sarathi.organization_memberships SET role='ADMIN' WHERE user_id=$1 AND organization_id=$2",
    [viewer, organizationId]
  );
  try {
    await assert.rejects(
      resolveOrganizationContext(runtime, viewer, organizationId, "projects.create"),
      denied
    );
    assert.deepEqual(
      (await context(viewer)).divisions.map((d) => d.id),
      [smart]
    );
  } finally {
    await owner.query(
      "UPDATE sarathi.organization_memberships SET role='VIEWER' WHERE user_id=$1 AND organization_id=$2",
      [viewer, organizationId]
    );
  }
});

test("operators need explicit financial authorization and runtime cannot modify membership permissions", async () => {
  await assert.rejects(
    resolveOrganizationContext(runtime, operator, organizationId, "payments.create"),
    denied
  );
  await owner.query(
    "UPDATE sarathi.organization_memberships SET can_record_payments=true WHERE user_id=$1 AND organization_id=$2",
    [operator, organizationId]
  );
  try {
    assert.ok(
      (
        await resolveOrganizationContext(runtime, operator, organizationId, "payments.create")
      ).permissions.includes("payments.create")
    );
  } finally {
    await owner.query(
      "UPDATE sarathi.organization_memberships SET can_record_payments=false WHERE user_id=$1 AND organization_id=$2",
      [operator, organizationId]
    );
  }
  for (const sql of [
    "UPDATE sarathi.organization_memberships SET role='ADMIN'",
    "DELETE FROM sarathi.division_assignments",
    "INSERT INTO sarathi.organizations(slug,name) VALUES ('forged','Forged')"
  ]) {
    await assert.rejects(
      runtime.query(sql),
      (e: unknown) => (e as { code?: string }).code === "42501"
    );
  }
});

test("composite foreign keys reject cross-organization division assignments and duplicate memberships", async () => {
  const member = (
    await owner.query(
      "SELECT id::text FROM sarathi.organization_memberships WHERE user_id=$1 AND organization_id=$2",
      [operator, organizationId]
    )
  ).rows[0].id;
  for (const [org, division] of [
    [organizationId, foreignDivision],
    [other, foreignDivision]
  ]) {
    await assert.rejects(
      owner.query(
        `INSERT INTO sarathi.division_assignments(organization_id,membership_id,division_id)
      VALUES ($1,$2,$3)`,
        [org, member, division]
      ),
      (e: unknown) => (e as { code?: string }).code === "23503"
    );
  }
  await assert.rejects(
    owner.query(
      `INSERT INTO sarathi.organization_memberships(organization_id,user_id,role)
    VALUES ($1,$2,'ADMIN')`,
      [organizationId, operator]
    ),
    (e: unknown) => (e as { code?: string }).code === "23505"
  );
});

test("authenticated context endpoint never trusts client identity or organization headers", async () => {
  const origin = process.env.OPERATIONS_TEST_URL!;
  const url = (org: string, division?: string) =>
    origin +
    "/api/admin/organization-context?organizationId=" +
    org +
    (division ? "&divisionId=" + division : "");
  assert.equal((await fetch(url(organizationId))).status, 403);
  const login = await fetch(origin + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "operator@example.test",
      password: process.env.OPERATIONS_TEST_PASSWORD
    })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const headers = { Cookie: cookie, "x-organization-id": other, "x-actor-id": admin };
  const valid = await fetch(url(organizationId, smart), { headers });
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.deepEqual(
    (await valid.json()).context.divisions.map((d: { id: string }) => d.id),
    [smart]
  );
  assert.equal((await fetch(url(other), { headers })).status, 403);
  assert.equal((await fetch(url(organizationId, digital), { headers })).status, 403);
  assert.equal((await fetch(url("bad-id"), { headers })).status, 400);
  assert.equal((await fetch(url(organizationId), { method: "POST", headers })).status, 405);
  await owner.query(
    "UPDATE sarathi.organization_memberships SET active=false WHERE user_id=$1 AND organization_id=$2",
    [operator, organizationId]
  );
  try {
    assert.equal((await fetch(url(organizationId), { headers })).status, 403);
  } finally {
    await owner.query(
      "UPDATE sarathi.organization_memberships SET active=true WHERE user_id=$1 AND organization_id=$2",
      [operator, organizationId]
    );
  }
});

test("additive migration preserves historical data, backfills roles and rolls back an injected failure", async () => {
  const database = "tenancy_backfill_" + randomUUID().replaceAll("-", "");
  const connection = new URL(process.env.DATABASE_MIGRATION_URL!);
  connection.pathname = "/" + database;
  await owner.query('CREATE DATABASE "' + database + '"');
  const legacy = new pg.Client({ connectionString: connection.toString() });
  try {
    await legacy.connect();
    for (const file of [
      "001_commercial_foundation.sql",
      "002_admin_authentication.sql",
      "003_admin_two_factor.sql",
      "004_role_based_access.sql",
      "005_workflow_guidance.sql"
    ]) {
      await legacy.query(
        await readFile(new URL("../../database/migrations/" + file, import.meta.url), "utf8")
      );
    }
    await legacy.query(`INSERT INTO sarathi.users(identity_subject,display_name,role,active)
      VALUES ('legacy-admin','Legacy admin','ADMIN',true),('legacy-viewer','Legacy viewer','VIEWER',true),('legacy-inactive','Legacy inactive','OPERATOR',false)`);
    await legacy.query(
      "INSERT INTO sarathi.customers(name,phone) VALUES ('Historical customer','9999999999')"
    );
    const before = (await legacy.query("SELECT * FROM sarathi.users ORDER BY id")).rows;
    const customers = (await legacy.query("SELECT * FROM sarathi.customers")).rows;
    const migration = await readFile(
      new URL("../../database/migrations/006_organization_foundation.sql", import.meta.url),
      "utf8"
    );
    await assert.rejects(
      legacy.query(
        migration.replace(
          "INSERT INTO sarathi.schema_migrations(version,name)",
          "SELECT 1/0; INSERT INTO sarathi.schema_migrations(version,name)"
        )
      )
    );
    await legacy.query("ROLLBACK");
    assert.equal(
      (await legacy.query("SELECT to_regclass('sarathi.organizations') AS table_name")).rows[0]
        .table_name,
      null
    );
    assert.equal(
      (
        await legacy.query(
          "SELECT count(*)::int AS n FROM sarathi.schema_migrations WHERE version=6"
        )
      ).rows[0].n,
      0
    );
    await legacy.query(migration);
    assert.deepEqual((await legacy.query("SELECT * FROM sarathi.users ORDER BY id")).rows, before);
    assert.deepEqual((await legacy.query("SELECT * FROM sarathi.customers")).rows, customers);
    const memberships = (
      await legacy.query(
        "SELECT user_id,role,active FROM sarathi.organization_memberships ORDER BY user_id"
      )
    ).rows;
    assert.deepEqual(
      memberships,
      before.map((u) => ({ user_id: u.id, role: u.role, active: u.active }))
    );
    assert.equal(
      (await legacy.query("SELECT count(*)::int AS n FROM sarathi.division_assignments")).rows[0].n,
      3
    );
  } finally {
    await legacy.end();
    await owner.query('DROP DATABASE "' + database + '"');
  }
});

test("owner provisioning rolls back identities if initial organization membership is unavailable", async () => {
  const email = "foundation-rollback@example.test";
  await owner.query("UPDATE sarathi.organizations SET active=false WHERE id=$1", [organizationId]);
  try {
    const result = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--import", "tsx", "scripts/provision-admin.ts"],
      {
        env: {
          ...process.env,
          SARATHI_ADMIN_EMAIL: email,
          SARATHI_ADMIN_NAME: "Rollback fixture",
          SARATHI_USER_ROLE: "ADMIN"
        },
        input: process.env.OPERATIONS_TEST_PASSWORD + "\n",
        encoding: "utf8",
        timeout: 15000
      }
    );
    assert.equal(result.status, 1);
    assert.equal(
      (await owner.query("SELECT 1 FROM sarathi.auth_users WHERE email=$1", [email])).rowCount,
      0
    );
    assert.equal(
      (await owner.query("SELECT 1 FROM sarathi.users WHERE display_name='Rollback fixture'"))
        .rowCount,
      0
    );
  } finally {
    await owner.query("UPDATE sarathi.organizations SET active=true WHERE id=$1", [organizationId]);
  }
});

test("ownership upgrade preserves frozen content, all legacy rows and timestamps atomically", async () => {
  const database = "ownership_upgrade_" + randomUUID().replaceAll("-", "");
  await owner.query('CREATE DATABASE "' + database + '"');
  const connection = new URL(process.env.DATABASE_MIGRATION_URL!);
  connection.pathname = "/" + database;
  const legacy = new pg.Client({ connectionString: connection.toString() });
  try {
    await legacy.connect();
    for (const file of [
      "001_commercial_foundation.sql",
      "002_admin_authentication.sql",
      "003_admin_two_factor.sql",
      "004_role_based_access.sql",
      "005_workflow_guidance.sql"
    ])
      await legacy.query(
        await readFile(new URL("../../database/migrations/" + file, import.meta.url), "utf8")
      );
    await legacy.query(`INSERT INTO sarathi.users(identity_subject,display_name,role) VALUES('legacy-owner','Legacy owner','ADMIN');
   INSERT INTO sarathi.customers(name,phone) VALUES('Preserved customer','9999999999');
   INSERT INTO sarathi.leads(customer_id,contact_name,phone,service_requested,status) VALUES(1,'Preserved lead','9999999999','CCTV','CONVERTED');
   INSERT INTO sarathi.projects(customer_id,lead_id,name,site_address,service_types) VALUES(1,1,'Preserved project','Mumbai',ARRAY['cctv','historical-service']);
   INSERT INTO sarathi.products(sku,name,unit) VALUES('PRESERVED','Camera','each');
   INSERT INTO sarathi.project_costings(project_id) VALUES(1);
   INSERT INTO sarathi.bom_items(project_id,product_id,position,description,unit,quantity,unit_cost,unit_sell) VALUES(1,1,1,'Camera','each',1,50,100);
   INSERT INTO sarathi.quotations(project_id,customer_id,version,created_by,customer_name,customer_phone,site_address,subtotal,total,recommended_advance,terms,valid_until)
    VALUES(1,1,1,1,'Preserved snapshot','9999999999','Mumbai',100,100,50,'Preserved terms',current_date+30);
   INSERT INTO sarathi.quotation_items(quotation_id,position,description,unit,quantity,unit_sell) VALUES(1,1,'Camera','each',1,100);
   UPDATE sarathi.quotations SET status='SENT',frozen_at=now(),sent_at=now() WHERE id=1;
   INSERT INTO sarathi.payments(project_id,quotation_id,kind,amount,idempotency_key,payment_method,occurred_at,recorded_by) VALUES(1,1,'RECEIPT',50,'legacy-payment','CASH',now(),1);
   INSERT INTO sarathi.status_history(project_id,to_status,was_on_hold,is_on_hold,reason,changed_by) VALUES(1,'SURVEY_PENDING',false,false,'Preserved history',1);`);
    await legacy.query(
      await readFile(
        new URL("../../database/migrations/006_organization_foundation.sql", import.meta.url),
        "utf8"
      )
    );
    const tables = [
      "customers",
      "leads",
      "projects",
      "products",
      "project_costings",
      "bom_items",
      "quotations",
      "quotation_items",
      "payments",
      "status_history"
    ];
    const before = new Map<string, unknown[]>();
    for (const table of tables)
      before.set(
        table,
        (await legacy.query(`SELECT to_jsonb(t) AS row FROM sarathi.${table} t`)).rows
      );
    const migration = await readFile(
      new URL("../../database/migrations/007_business_ownership.sql", import.meta.url),
      "utf8"
    );
    await assert.rejects(
      legacy.query(
        migration.replace(
          "INSERT INTO sarathi.schema_migrations(version,name)",
          "SELECT 1/0; INSERT INTO sarathi.schema_migrations(version,name)"
        )
      )
    );
    await legacy.query("ROLLBACK");
    assert.equal(
      (
        await legacy.query(
          "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='sarathi' AND table_name='customers' AND column_name='organization_id'"
        )
      ).rows[0].n,
      0
    );
    await legacy.query(migration);
    for (const table of tables) {
      assert.deepEqual(
        (
          await legacy.query(
            `SELECT to_jsonb(t)-'organization_id'-'division_id' AS row FROM sarathi.${table} t`
          )
        ).rows,
        before.get(table)
      );
      assert.equal(
        (
          await legacy.query(
            `SELECT count(*)::int AS n FROM sarathi.${table} WHERE organization_id=1`
          )
        ).rows[0].n,
        1
      );
    }
    await assert.rejects(
      legacy.query("UPDATE sarathi.payments SET note='changed' WHERE id=1"),
      (e: unknown) => (e as { code?: string }).code === "23514"
    );
    await assert.rejects(
      legacy.query("UPDATE sarathi.status_history SET reason='changed' WHERE id=1"),
      (e: unknown) => (e as { code?: string }).code === "23514"
    );
    await assert.rejects(
      legacy.query("UPDATE sarathi.quotations SET terms='changed' WHERE id=1"),
      (e: unknown) => (e as { code?: string }).code === "23514"
    );
  } finally {
    await legacy.end();
    await owner.query('DROP DATABASE "' + database + '"');
  }
});
