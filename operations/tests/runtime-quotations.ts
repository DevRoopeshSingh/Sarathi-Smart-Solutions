import assert from "node:assert/strict";
import { test, after } from "node:test";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { tenantPool } from "../src/server/tenant-pool";
import { getPool } from "../src/server/db";
import * as quotes from "../src/server/quotations";
import * as business from "../src/server/business";
import { getCustomerProfile } from "../src/server/customers";
import { AccessDeniedError } from "../src/server/mutation-errors";
import type { QuoteDraftInput } from "../src/server/quotation-input";
if (process.env.OPERATIONS_TEST_ISOLATED !== "1") throw new Error("Use the isolated harness.");
const owner = new pg.Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, max: 1 }),
  runtime = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6 });
after(async () => {
  await owner.end();
  await runtime.end();
  await getPool().end();
});
const org = (await owner.query("SELECT id::text FROM sarathi.organizations WHERE slug='sarathi'"))
  .rows[0].id;
const divisions = (
  await owner.query(
    "SELECT id::text,slug FROM sarathi.divisions WHERE organization_id=$1 ORDER BY id",
    [org]
  )
).rows;
const smart = divisions.find((d) => d.slug === "smart-solutions").id,
  digital = divisions.find((d) => d.slug === "digital-seva-kendra").id;
const actor = (
  await owner.query(
    "SELECT u.id::text FROM sarathi.users u JOIN sarathi.auth_users a ON a.id=u.identity_subject WHERE a.email='admin@example.test'"
  )
).rows[0].id;
const scope = (permission: Parameters<typeof tenantPool>[3]) =>
  tenantPool(runtime, actor, org, permission);
async function login(email: string) {
  await owner.query("DELETE FROM sarathi.auth_ratelimits");
  const response = await fetch(process.env.OPERATIONS_TEST_URL + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: process.env.OPERATIONS_TEST_URL!, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: process.env.OPERATIONS_TEST_PASSWORD })
  });
  assert.equal(response.status, 200);
  return new Headers({
    Cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
  });
}
const admin = await login("admin@example.test"),
  operator = await login("operator@example.test"),
  viewer = await login("viewer@example.test"),
  foreign = await login("b-admin@example.test");
const customer = await business.createCustomer(scope("customers.create"), {
  name: "Quotation QA ग्राहक",
  phone: "9999999999"
});
const input = (changes: Partial<QuoteDraftInput> = {}): QuoteDraftInput => ({
  customerId: customer.id,
  divisionId: smart,
  title: "Quotation integration",
  siteAddress: "",
  discount: "0.01",
  taxMode: "NONE",
  validUntil: "2099-12-31",
  terms: "Delivery by agreement. No advance is recorded.",
  items: [
    { description: "Camera", quantity: "2.500", unit: "each", rate: "100.01", taxPercent: "0" },
    {
      description: "Installation / स्थापना",
      quantity: "1",
      unit: "service",
      rate: "50",
      taxPercent: "0"
    }
  ],
  ...changes
});
const draft = () => quotes.createDraft(scope("quotations.create"), actor, input(), randomUUID());
const record = async (id: string) =>
  (await owner.query("SELECT *,total::text AS total FROM sarathi.quotations WHERE id=$1", [id]))
    .rows[0];
const decision = { reason: "Customer confirmed by telephone; staff note", acknowledge: true };
async function issue(id: string) {
  const row = await record(id);
  return quotes.issueQuote(scope("quotations.update"), actor, id, String(row.draft_version));
}
test("draft create retries concurrently once; mismatched payload cannot reuse a key", async () => {
  const key = randomUUID();
  const [a, b] = await Promise.all([
    quotes.createDraft(scope("quotations.create"), actor, input(), key),
    quotes.createDraft(scope("quotations.create"), actor, input(), key)
  ]);
  assert.equal(a.id, b.id);
  assert.equal((await record(a.id)).total, "300.02");
  assert.equal(
    (
      await owner.query(
        "SELECT count(*)::int AS n FROM sarathi.quotation_items WHERE quotation_id=$1",
        [a.id]
      )
    ).rows[0].n,
    2
  );
  await assert.rejects(
    quotes.createDraft(scope("quotations.create"), actor, input({ title: "Changed" }), key),
    /different details/
  );
});
test("editing recalculates totals, increments the version and rejects stale saves", async () => {
  const q = await draft();
  const data = input({
    items: [
      {
        description: "One revised item",
        unit: "service",
        quantity: "1",
        rate: "123.45",
        taxPercent: "0"
      }
    ]
  });
  await quotes.editDraft(scope("quotations.update"), data, q.id, "1");
  assert.equal((await record(q.id)).total, "123.44");
  assert.equal((await record(q.id)).draft_version, 2);
  await assert.rejects(quotes.editDraft(scope("quotations.update"), input(), q.id, "1"), /changed/);
  assert.equal(
    (
      await owner.query(
        "SELECT event FROM sarathi.quotation_events WHERE quotation_id=$1 ORDER BY id",
        [q.id]
      )
    ).rows.at(-1).event,
    "EDITED"
  );
});
test("standalone quotations work for all three divisions and appear in customer records", async () => {
  for (const d of divisions) {
    const q = await quotes.saveQuotation(admin, input({ divisionId: d.id }), randomUUID());
    assert.equal((await record(q.id)).project_id, null);
    await issue(q.id);
    const document = await quotes.quotationPdf(admin, q.id);
    assert.ok(document?.pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
    const profile = await getCustomerProfile(admin, customer.id, { section: "quotes" });
    assert.ok(profile?.items.some((row) => row.id === q.id));
  }
});
test("concurrent issue returns one immutable PDF and one audit event", async () => {
  const q = await draft();
  await Promise.all([issue(q.id), issue(q.id)]);
  const row = await record(q.id);
  assert.equal(row.status, "SENT");
  assert.match(row.quote_number, /^SAR-SMART-\d{4}-\d{6}\/R1$/);
  const doc = await quotes.quotationPdf(admin, q.id);
  assert.equal(doc!.sha256, createHash("sha256").update(doc!.pdf).digest("hex"));
  assert.equal(
    (
      await owner.query(
        "SELECT 1 FROM sarathi.quotation_events WHERE quotation_id=$1 AND event='ISSUED'",
        [q.id]
      )
    ).rowCount,
    1
  );
  const response = await fetch(
    process.env.OPERATIONS_TEST_URL + "/api/admin/quotations/" + q.id + "/pdf",
    { headers: admin }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-disposition")!, /^attachment;/);
  assert.equal(Buffer.from(await response.arrayBuffer()).equals(doc!.pdf), true);
});
test("concurrent different quotes receive unique numbers", async () => {
  const a = await draft(),
    b = await draft();
  await Promise.all([issue(a.id), issue(b.id)]);
  assert.notEqual((await record(a.id)).quote_number, (await record(b.id)).quote_number);
});
test("customer edits leave issued content, artifact bytes and snapshot untouched", async () => {
  const q = await draft();
  await issue(q.id);
  const before = await quotes.quotationPdf(admin, q.id);
  const version = (
    await owner.query("SELECT version FROM sarathi.customers WHERE id=$1", [customer.id])
  ).rows[0].version;
  await business.updateCustomer(
    scope("customers.update"),
    customer.id,
    { name: "Updated QA name", phone: "9999999999", address: "Updated Mumbai address" },
    String(version)
  );
  const afterDoc = await quotes.quotationPdf(admin, q.id);
  assert.equal(afterDoc!.sha256, before!.sha256);
  assert.equal(afterDoc!.pdf.equals(before!.pdf), true);
  assert.equal((await record(q.id)).customer_name, "Quotation QA ग्राहक");
});
test("frozen quotation columns, items, snapshots and audit cannot be rewritten", async () => {
  const q = await draft();
  await issue(q.id);
  await assert.rejects(
    scope("quotations.update").query("UPDATE sarathi.quotations SET total=1 WHERE id=$1", [q.id]),
    (e: unknown) => (e as { code: string }).code === "23514"
  );
  await assert.rejects(
    owner.query("UPDATE sarathi.quotation_items SET description='rewrite' WHERE quotation_id=$1", [
      q.id
    ]),
    (e: unknown) => (e as { code: string }).code === "23514"
  );
  for (const sql of [
    "UPDATE sarathi.quotation_documents SET snapshot='{}'::jsonb WHERE quotation_id=$1",
    "DELETE FROM sarathi.quotation_events WHERE quotation_id=$1"
  ])
    await assert.rejects(
      owner.query(sql, [q.id]),
      (e: unknown) => (e as { code: string }).code === "23514"
    );
});
test("generation failure rolls back numbering, artifact, status and issue event", async () => {
  const q = await draft();
  const counters = await owner.query(
    "SELECT * FROM sarathi.quotation_counters ORDER BY division_id,issue_year"
  );
  await assert.rejects(
    quotes.issueQuote(scope("quotations.update"), actor, q.id, "1", async () => {
      throw new Error("Injected renderer failure");
    }),
    /Injected/
  );
  assert.equal((await record(q.id)).status, "DRAFT");
  assert.equal(
    (await owner.query("SELECT 1 FROM sarathi.quotation_documents WHERE quotation_id=$1", [q.id]))
      .rowCount,
    0
  );
  assert.deepEqual(
    (await owner.query("SELECT * FROM sarathi.quotation_counters ORDER BY division_id,issue_year"))
      .rows,
    counters.rows
  );
  assert.equal(
    (
      await owner.query(
        "SELECT 1 FROM sarathi.quotation_events WHERE quotation_id=$1 AND event='ISSUED'",
        [q.id]
      )
    ).rowCount,
    0
  );
});
test("database rejects issuing a new quotation without its artifact", async () => {
  const q = await draft();
  await assert.rejects(
    scope("quotations.update").query(
      "UPDATE sarathi.quotations SET status='SENT',quote_number='missing-artifact',sent_at=now(),frozen_at=now() WHERE id=$1",
      [q.id]
    ),
    (e: unknown) => (e as { code: string }).code === "23514"
  );
  assert.equal((await record(q.id)).status, "DRAFT");
});
test("stale issue and expired drafts fail; expired offers cannot be accepted", async () => {
  const q = await draft();
  await quotes.editDraft(scope("quotations.update"), input(), q.id, "1");
  await assert.rejects(quotes.issueQuote(scope("quotations.update"), actor, q.id, "1"), /changed/);
  const old = await quotes.createDraft(
    scope("quotations.create"),
    actor,
    input({ validUntil: "2000-01-01" }),
    randomUUID()
  );
  await assert.rejects(issue(old.id), /validity date/);
  // Simulate a historical expired issued offer as owner; never alter an issued snapshot.
  const legacy = (
    await owner.query(
      `INSERT INTO sarathi.quotations(customer_id,division_id,version,created_by,customer_name,customer_phone,site_address,subtotal,total,recommended_advance,terms,valid_until)
 VALUES($1,$2,1,$3,'Expired fixture','9999999999','',1,1,0,'Expired',CURRENT_DATE-1) RETURNING id::text`,
      [customer.id, smart, actor]
    )
  ).rows[0];
  await owner.query(
    "UPDATE sarathi.quotations SET status='SENT',sent_at=now(),frozen_at=now() WHERE id=$1",
    [legacy.id]
  );
  await assert.rejects(
    quotes.decideQuote(scope("quotations.update"), actor, legacy.id, true, decision),
    /expired/
  );
});
test("staff acceptance and rejection are audited and idempotent without payments", async () => {
  const before = (await owner.query("SELECT count(*)::int AS n FROM sarathi.payments")).rows[0].n;
  const q = await draft();
  await issue(q.id);
  await Promise.all([
    quotes.decideQuote(scope("quotations.update"), actor, q.id, true, decision),
    quotes.decideQuote(scope("quotations.update"), actor, q.id, true, decision)
  ]);
  assert.equal((await record(q.id)).status, "APPROVED");
  const events = (
    await owner.query(
      "SELECT * FROM sarathi.quotation_events WHERE quotation_id=$1 AND event='ACCEPTED_STAFF'",
      [q.id]
    )
  ).rows;
  assert.equal(events.length, 1);
  assert.equal(String(events[0].recorded_by), actor);
  assert.match(events[0].reason, /Staff-recorded/);
  const rejected = await draft();
  await issue(rejected.id);
  await quotes.decideQuote(scope("quotations.update"), actor, rejected.id, false, decision);
  await quotes.decideQuote(scope("quotations.update"), actor, rejected.id, false, decision);
  assert.equal((await record(rejected.id)).status, "DECLINED");
  assert.equal(
    (await owner.query("SELECT count(*)::int AS n FROM sarathi.payments")).rows[0].n,
    before
  );
});
test("revisions preserve the accepted baseline until the new version is accepted", async () => {
  const q = await draft();
  await issue(q.id);
  await quotes.decideQuote(scope("quotations.update"), actor, q.id, true, decision);
  const key = randomUUID();
  const revision = await quotes.reviseQuote(scope("quotations.create"), actor, q.id, key);
  assert.equal(
    (await quotes.reviseQuote(scope("quotations.create"), actor, q.id, key)).id,
    revision.id
  );
  assert.equal((await record(q.id)).status, "APPROVED");
  await issue(revision.id);
  assert.equal((await record(q.id)).status, "APPROVED");
  assert.equal((await record(revision.id)).root_quotation_id, q.id);
  assert.equal(
    (await record(revision.id)).quote_number,
    (await record(q.id)).quote_number.replace(/R1$/, "R2")
  );
  await quotes.decideQuote(scope("quotations.update"), actor, revision.id, true, decision);
  assert.equal((await record(q.id)).status, "SUPERSEDED");
  assert.equal((await record(revision.id)).status, "APPROVED");
  assert.ok(await quotes.quotationPdf(admin, q.id));
});
test("one project baseline survives concurrent acceptance; optional progression is audited", async () => {
  const project = await business.createProject(scope("projects.create"), actor, {
    customerId: customer.id,
    name: "Quotation project",
    siteAddress: "Mumbai",
    serviceTypes: ["cctv"]
  });
  await business.updateProjectStatus(
    scope("projects.update"),
    actor,
    project.id,
    "COSTING",
    "SURVEY_PENDING",
    "Survey previously completed"
  );
  const data = input({ projectId: project.id, siteAddress: "Mumbai" }),
    a = await quotes.createDraft(scope("quotations.create"), actor, data, randomUUID()),
    b = await quotes.createDraft(scope("quotations.create"), actor, data, randomUUID());
  await Promise.all([issue(a.id), issue(b.id)]);
  const results = await Promise.allSettled([
    quotes.decideQuote(scope("quotations.update"), actor, a.id, true, {
      ...decision,
      advanceProject: true
    }),
    quotes.decideQuote(scope("quotations.update"), actor, b.id, true, {
      ...decision,
      advanceProject: true
    })
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (
      await owner.query(
        "SELECT 1 FROM sarathi.quotations WHERE project_id=$1 AND status='APPROVED'",
        [project.id]
      )
    ).rowCount,
    1
  );
  assert.equal(
    (await owner.query("SELECT operational_status FROM sarathi.projects WHERE id=$1", [project.id]))
      .rows[0].operational_status,
    "PROCUREMENT"
  );
  assert.equal(
    (
      await owner.query(
        "SELECT 1 FROM sarathi.status_history WHERE project_id=$1 AND to_status='PROCUREMENT'",
        [project.id]
      )
    ).rowCount,
    1
  );
});
test("held projects and stage skips fail atomically without accepting the offer", async () => {
  const project = await business.createProject(scope("projects.create"), actor, {
    customerId: customer.id,
    name: "Held quote project",
    siteAddress: "Mumbai",
    serviceTypes: ["cctv"]
  });
  const q = await quotes.createDraft(
    scope("quotations.create"),
    actor,
    input({ projectId: project.id, siteAddress: "Mumbai" }),
    randomUUID()
  );
  await issue(q.id);
  await assert.rejects(
    quotes.decideQuote(scope("quotations.update"), actor, q.id, true, {
      ...decision,
      advanceProject: true
    }),
    /reason/
  );
  assert.equal((await record(q.id)).status, "SENT");
  await owner.query(
    "UPDATE sarathi.projects SET on_hold=true,hold_reason='Awaiting access' WHERE id=$1",
    [project.id]
  );
  await assert.rejects(
    quotes.decideQuote(scope("quotations.update"), actor, q.id, true, {
      ...decision,
      advanceProject: true,
      stageReason: "Confirmed scope"
    }),
    /hold/
  );
  assert.equal((await record(q.id)).status, "SENT");
  await quotes.decideQuote(scope("quotations.update"), actor, q.id, true, decision);
  assert.equal((await record(q.id)).status, "APPROVED");
});
test("viewer mutations and unauthorized division writes are denied", async () => {
  const q = await draft();
  for (const work of [
    () => quotes.saveQuotation(viewer, input(), randomUUID()),
    () => quotes.issueQuotation(viewer, q.id, "1"),
    () => quotes.reviseQuotation(viewer, q.id, randomUUID()),
    () => quotes.decideQuotation(viewer, q.id, true, decision),
    () => quotes.saveQuotation(operator, input({ divisionId: digital }), randomUUID())
  ])
    await assert.rejects(work, AccessDeniedError);
});
test("cross-tenant and cross-division PDF/read/mutation access fail closed", async () => {
  const q = await quotes.saveQuotation(admin, input({ divisionId: digital }), randomUUID());
  await issue(q.id);
  for (const h of [foreign, operator]) {
    assert.equal(await quotes.quotationDetail(h, q.id), null);
    assert.equal(await quotes.quotationPdf(h, q.id), null);
    await assert.rejects(quotes.issueQuotation(h, q.id, "1"));
    const response = await fetch(
      process.env.OPERATIONS_TEST_URL + "/api/admin/quotations/" + q.id + "/pdf",
      { headers: h }
    );
    assert.equal(response.status, 404);
  }
  assert.equal(
    (await fetch(process.env.OPERATIONS_TEST_URL + "/api/admin/quotations/" + q.id + "/pdf"))
      .status,
    403
  );
  const own = await draft();
  await issue(own.id);
  assert.ok(await quotes.quotationPdf(viewer, own.id));
});
test("unrelated project/customer links and foreign standalone customers are rejected", async () => {
  const other = await business.createCustomer(scope("customers.create"), {
    name: "Other quote customer",
    phone: "8888888888"
  });
  const project = await business.createProject(scope("projects.create"), actor, {
    customerId: other.id,
    name: "Other project",
    siteAddress: "Mumbai",
    serviceTypes: ["cctv"]
  });
  await assert.rejects(
    quotes.saveQuotation(
      admin,
      input({ projectId: project.id, siteAddress: "Mumbai" }),
      randomUUID()
    ),
    /belong/
  );
  const otherOrg = (
    await owner.query("SELECT id FROM sarathi.customers WHERE organization_id<>$1 LIMIT 1", [org])
  ).rows[0].id;
  await assert.rejects(
    quotes.saveQuotation(admin, input({ customerId: String(otherOrg) }), randomUUID()),
    /authorized customer/
  );
});
test("unscoped runtime cannot read documents, counters or alter identity/audit", async () => {
  assert.equal((await runtime.query("SELECT * FROM sarathi.quotation_documents")).rowCount, 0);
  for (const sql of [
    "SELECT * FROM sarathi.quotation_counters",
    "UPDATE sarathi.quotations SET organization_id=2",
    "DELETE FROM sarathi.quotations",
    "UPDATE sarathi.quotation_documents SET sha256=repeat('0',64)",
    "INSERT INTO sarathi.quotation_events(organization_id,quotation_id,event,to_status,draft_version) VALUES(1,1,'FORGED','SENT',1)"
  ])
    await assert.rejects(
      runtime.query(sql),
      (e: unknown) => (e as { code: string }).code === "42501"
    );
});

test("artifact storage and final audit failures roll back and can be retried", async () => {
  const q = await draft();
  await assert.rejects(
    quotes.issueQuote(scope("quotations.update"), actor, q.id, "1", async () =>
      Buffer.from("Invalid PDF")
    ),
    (e: unknown) => (e as { code: string }).code === "23514"
  );
  assert.equal((await record(q.id)).status, "DRAFT");
  await owner.query(`CREATE FUNCTION sarathi.fixture_quote_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.event='ISSUED' THEN RAISE EXCEPTION 'Injected quotation audit failure' USING ERRCODE='23514'; END IF;RETURN NEW;END;$$;
 CREATE TRIGGER fixture_quote_audit_failure BEFORE INSERT ON sarathi.quotation_events FOR EACH ROW EXECUTE FUNCTION sarathi.fixture_quote_audit_failure()`);
  try {
    await assert.rejects(issue(q.id), (e: unknown) => (e as { code: string }).code === "23514");
    assert.equal((await record(q.id)).status, "DRAFT");
    assert.equal(
      (await owner.query("SELECT 1 FROM sarathi.quotation_documents WHERE quotation_id=$1", [q.id]))
        .rowCount,
      0
    );
  } finally {
    await owner.query(
      "DROP TRIGGER fixture_quote_audit_failure ON sarathi.quotation_events;DROP FUNCTION sarathi.fixture_quote_audit_failure()"
    );
  }
  await issue(q.id);
  assert.equal((await record(q.id)).status, "SENT");
});
test("verified tax profiles calculate and freeze exclusive and inclusive offers", async () => {
  const original = (
    await owner.query("SELECT document_settings FROM sarathi.divisions WHERE id=$1", [smart])
  ).rows[0].document_settings;
  await owner.query(
    "UPDATE sarathi.divisions SET document_settings=document_settings || $2::jsonb WHERE id=$1",
    [smart, JSON.stringify({ gstVerified: true, gstin: "27ABCDE1234F1Z5", gstRates: ["18"] })]
  );
  try {
    for (const mode of ["GST_EXCLUSIVE", "GST_INCLUSIVE"] as const) {
      const data = input({
        taxMode: mode,
        items: input().items.map((i) => ({ ...i, taxPercent: "18" }))
      });
      const q = await quotes.saveQuotation(admin, data, randomUUID());
      await issue(q.id);
      const snapshot = (
        await owner.query(
          "SELECT snapshot FROM sarathi.quotation_documents WHERE quotation_id=$1",
          [q.id]
        )
      ).rows[0].snapshot;
      assert.equal(snapshot.taxMode, mode);
      assert.equal(snapshot.business.gstin, "27ABCDE1234F1Z5");
      assert.equal(snapshot.total, (await record(q.id)).total);
      assert.notEqual(snapshot.tax, "0.00");
    }
  } finally {
    await owner.query("UPDATE sarathi.divisions SET document_settings=$2 WHERE id=$1", [
      smart,
      original
    ]);
  }
});
test("database composite FK rejects a foreign standalone customer", async () => {
  const foreignCustomer = (
    await owner.query("SELECT id::text FROM sarathi.customers WHERE organization_id<>$1 LIMIT 1", [
      org
    ])
  ).rows[0].id;
  await assert.rejects(
    scope("quotations.create").query(
      `INSERT INTO sarathi.quotations(customer_id,division_id,version,created_by,customer_name,customer_phone,site_address,subtotal,total,recommended_advance,terms,valid_until,creation_request_id,creation_request_hash,tax_mode)
 VALUES($1,$2,1,$3,'Untrusted','9999999999','',1,1,0,'Terms',CURRENT_DATE+30,$4,repeat('0',64),'NONE')`,
      [foreignCustomer, smart, actor, randomUUID()]
    ),
    (e: unknown) => (e as { code: string }).code === "23503"
  );
});
test("quotation upgrade preserves every legacy quotation/item field and rejects conflicting baselines atomically", async () => {
  const db = "quotation_upgrade_" + randomUUID().replaceAll("-", "");
  await owner.query('CREATE DATABASE "' + db + '"');
  const url = new URL(process.env.DATABASE_MIGRATION_URL!);
  url.pathname = "/" + db;
  const client = new pg.Client({ connectionString: url.toString() });
  try {
    await client.connect();
    const files = [
      "001_commercial_foundation.sql",
      "002_admin_authentication.sql",
      "003_admin_two_factor.sql",
      "004_role_based_access.sql",
      "005_workflow_guidance.sql",
      "006_organization_foundation.sql",
      "007_business_ownership.sql",
      "008_customer_management.sql"
    ];
    for (const file of files)
      await client.query(
        await readFile(new URL("../../database/migrations/" + file, import.meta.url), "utf8")
      );
    await client.query(`INSERT INTO sarathi.users(identity_subject,display_name,role) VALUES('legacy-quotation','Legacy actor','ADMIN');
 INSERT INTO sarathi.organization_memberships(organization_id,user_id,role) VALUES(1,1,'ADMIN');
 INSERT INTO sarathi.customers(name,phone) VALUES('Preserved quote customer','9999999999');
 INSERT INTO sarathi.projects(customer_id,name,site_address) VALUES(1,'Preserved quote project','Mumbai');
 INSERT INTO sarathi.quotations(project_id,customer_id,version,created_by,customer_name,customer_phone,site_address,subtotal,total,recommended_advance,terms,valid_until)
 VALUES(1,1,1,1,'Frozen customer','9999999999','Mumbai',100,100,0,'Original legal terms',CURRENT_DATE+30),
 (1,1,2,1,'Frozen customer','9999999999','Mumbai',200,200,0,'Original revised terms',CURRENT_DATE+30);
 INSERT INTO sarathi.quotation_items(quotation_id,position,description,unit,quantity,unit_sell) VALUES(1,1,'Preserved item','each',1,100);
 UPDATE sarathi.quotations SET status='SENT',frozen_at=now(),sent_at=now();UPDATE sarathi.quotations SET status='APPROVED',approved_at=now();`);
    const migration = await readFile(
      new URL("../../database/migrations/009_quotation_management.sql", import.meta.url),
      "utf8"
    );
    await assert.rejects(
      client.query(migration),
      (e: unknown) => (e as { code: string }).code === "23505"
    );
    await client.query("ROLLBACK");
    assert.equal(
      (
        await client.query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='sarathi' AND table_name='quotations' AND column_name='quote_number'"
        )
      ).rowCount,
      0
    );
    // A deliberate owner reconciliation retains the old accepted row and content as superseded.
    await client.query("UPDATE sarathi.quotations SET status='SUPERSEDED' WHERE id=1");
    const before = (await client.query("SELECT * FROM sarathi.quotations ORDER BY id")).rows,
      itemsBefore = (await client.query("SELECT * FROM sarathi.quotation_items")).rows;
    await client.query(migration);
    const afterRows = (await client.query("SELECT * FROM sarathi.quotations ORDER BY id")).rows;
    for (let i = 0; i < before.length; i++)
      assert.deepEqual(
        Object.fromEntries(Object.keys(before[i]).map((key) => [key, afterRows[i][key]])),
        before[i]
      );
    const itemsAfter = (await client.query("SELECT * FROM sarathi.quotation_items")).rows;
    assert.deepEqual(
      Object.fromEntries(Object.keys(itemsBefore[0]).map((key) => [key, itemsAfter[0][key]])),
      itemsBefore[0]
    );
  } finally {
    await client.end();
    await owner.query('DROP DATABASE "' + db + '"');
  }
});

test("direct HTTP quotation actions reject forged scope, viewer and anonymous mutations", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../.next/server/server-reference-manifest.json", import.meta.url),
      "utf8"
    )
  );
  async function action(name: string, args: unknown[], h: Headers) {
    const entry = Object.entries(manifest.node).find(
      ([, value]) => (value as { exportedName: string }).exportedName === name
    );
    assert.ok(entry);
    const body = new FormData();
    body.set("0", JSON.stringify(args));
    const headers = new Headers(h);
    headers.set("Accept", "text/x-component");
    headers.set("Origin", process.env.OPERATIONS_TEST_URL!);
    headers.set("Next-Action", entry[0]);
    headers.set("x-sarathi-organization-id", "9999");
    const response = await fetch(process.env.OPERATIONS_TEST_URL + "/admin/quotes", {
      method: "POST",
      headers,
      body,
      redirect: "manual"
    });
    assert.equal(response.status, 200);
    return response.text();
  }
  const q = await draft();
  for (const [name, args, h] of [
    ["saveQuoteAction", [input(), randomUUID()], viewer],
    ["saveQuoteAction", [input({ divisionId: digital }), randomUUID()], operator],
    ["issueQuoteAction", [q.id, "1"], foreign],
    ["decisionQuoteAction", [q.id, true, decision], viewer],
    ["saveQuoteAction", [input(), randomUUID()], new Headers()]
  ] as const) {
    const result = await action(name, [...args], h);
    assert.ok(result.includes('"error":'));
    assert.ok(!result.includes('"id":'));
    assert.ok(!result.includes("PRIVATE"));
  }
  const before = (await owner.query("SELECT count(*)::int AS n FROM sarathi.quotations")).rows[0].n;
  const valid = await action(
    "saveQuoteAction",
    [{ ...input(), total: "0.01" }, randomUUID()],
    admin
  );
  assert.ok(valid.includes('"id":'));
  assert.equal(
    (await owner.query("SELECT count(*)::int AS n FROM sarathi.quotations")).rows[0].n,
    before + 1
  );
  assert.equal(
    (await owner.query("SELECT total::text FROM sarathi.quotations ORDER BY id DESC LIMIT 1"))
      .rows[0].total,
    "300.02"
  );
});

test("audit and revision pages expose complete authorized history without duplicates", async () => {
  let q = await draft();
  const root = q.id;
  for (let i = 1; i <= 28; i++)
    await quotes.editDraft(
      scope("quotations.update"),
      input({ title: "History edit " + i }),
      root,
      String(i)
    );
  let detail = await quotes.quotationDetail(admin, root);
  assert.equal(detail!.events.length, 25);
  assert.ok(detail!.next);
  const firstIds = detail!.events.map((e) => e.id);
  const older = await quotes.quotationDetail(admin, root, detail!.next!);
  assert.equal(older!.events.length, 4);
  assert.equal(new Set([...firstIds, ...older!.events.map((e) => e.id)]).size, 29);
  await issue(q.id);
  await quotes.decideQuote(scope("quotations.update"), actor, q.id, false, decision);
  for (let i = 2; i <= 27; i++) {
    q = await quotes.reviseQuote(scope("quotations.create"), actor, q.id, randomUUID());
    await issue(q.id);
    await quotes.decideQuote(scope("quotations.update"), actor, q.id, false, decision);
  }
  detail = await quotes.quotationDetail(admin, root);
  assert.equal(detail!.versions.length, 25);
  assert.ok(detail!.versionsNext);
  const next = await quotes.quotationDetail(admin, root, undefined, String(detail!.versionsNext));
  assert.equal(next!.versions.length, 2);
  assert.equal(new Set([...detail!.versions, ...next!.versions].map((v) => v.id)).size, 27);
  assert.equal(detail!.quote.latestVersion, 27);
  await assert.rejects(
    quotes.reviseQuote(scope("quotations.create"), actor, root, randomUUID()),
    /latest/
  );
});
