import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
import { tenantPool } from "../src/server/tenant-pool";
import { getPool } from "../src/server/db";
import * as payments from "../src/server/payments";
import * as business from "../src/server/business";
import * as quotes from "../src/server/quotations";
import { getCustomerProfile } from "../src/server/customers";
import { AccessDeniedError } from "../src/server/mutation-errors";
import type { PaymentInput } from "../src/lib/payments";
import type { Permission } from "../src/server/permissions";
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
const smart = (
  await owner.query(
    "SELECT id::text FROM sarathi.divisions WHERE organization_id=$1 AND slug='smart-solutions'",
    [org]
  )
).rows[0].id;
async function actorFor(email: string) {
  return (
    await owner.query(
      "SELECT u.id::text FROM sarathi.users u JOIN sarathi.auth_users a ON a.id=u.identity_subject WHERE a.email=$1",
      [email]
    )
  ).rows[0].id;
}
const actor = await actorFor("admin@example.test"),
  op = await actorFor("operator@example.test");
const scope = (permission: Permission, user = actor) => tenantPool(runtime, user, org, permission);
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
  name: "Payment QA ग्राहक",
  phone: "9876543210"
});
const project = await business.createProject(scope("projects.create"), actor, {
  customerId: customer.id,
  name: "Payment QA project",
  siteAddress: "Bhayandar",
  serviceTypes: ["cctv", "network"]
});
const input = (patch: Partial<PaymentInput> = {}): PaymentInput => ({
  projectId: project.id,
  amount: "100.01",
  method: "CASH",
  reference: "",
  purpose: "ADVANCE",
  note: "Synthetic payment fixture",
  occurredAt: "2026-01-01T12:00:00+05:30",
  acknowledge: true,
  ...patch
});
const receipt = (patch: Partial<PaymentInput> = {}, key = randomUUID()) =>
  payments.recordPayment(scope("payments.create"), actor, input(patch), key);
const refund = (id: string, amount: string, key = randomUUID()) =>
  payments.recordPayment(
    scope("payments.refund"),
    actor,
    input({
      projectId: undefined,
      refundOfId: id,
      amount,
      purpose: "REFUND",
      note: "Customer refund completed"
    }),
    key
  );
async function accepted(projectId: string | null = null, divisionId = smart, rate = "100.01") {
  const q = await quotes.createDraft(
    scope("quotations.create"),
    actor,
    {
      customerId: customer.id,
      divisionId,
      projectId: projectId ?? undefined,
      title: "Payment QA quotation",
      siteAddress: projectId ? "Bhayandar" : "",
      discount: "0",
      taxMode: "NONE",
      validUntil: "2099-12-31",
      terms: "Synthetic QA only",
      items: [
        { description: "CCTV service", unit: "service", quantity: "1", rate, taxPercent: "0" }
      ]
    },
    randomUUID()
  );
  await quotes.issueQuote(scope("quotations.update"), actor, q.id, "1");
  await quotes.decideQuote(scope("quotations.update"), actor, q.id, true, {
    reason: "Staff record of confirmed terms",
    acknowledge: true
  });
  return q;
}
const payRow = async (id: string) =>
  (await owner.query("SELECT * FROM sarathi.payments WHERE id=$1", [id])).rows[0];
const paymentCount = async () =>
  (await owner.query("SELECT count(*)::int AS n FROM sarathi.payments")).rows[0].n;
test("concurrent keyed receipts persist one ledger row, PDF, number and audit", async () => {
  const key = randomUUID();
  const [a, b] = await Promise.all([receipt({}, key), receipt({}, key)]);
  assert.equal(a.id, b.id);
  assert.equal(a.number, b.number);
  const docs = (
    await owner.query("SELECT * FROM sarathi.payment_documents WHERE payment_id=$1", [a.id])
  ).rows;
  assert.equal(docs.length, 1);
  assert.equal(docs[0].sha256, createHash("sha256").update(docs[0].pdf).digest("hex"));
  assert.equal(docs[0].snapshot.amount, "100.01");
  assert.equal(
    (
      await owner.query(
        "SELECT * FROM sarathi.payment_events WHERE payment_id=$1 AND event='RECEIPT'",
        [a.id]
      )
    ).rowCount,
    1
  );
  await assert.rejects(receipt({ amount: "100.02" }, key), /different details/);
});
test("admin receipt corrections preserve the source, reverse allocations and do not claim cash refunds", async () => {
  const q = await accepted(),
    p = await receipt({ projectId: undefined, quotationId: q.id, amount: "1.00" }),
    original = await payRow(p.id);
  const adjustment = await payments.recordPayment(
    scope("payments.refund"),
    actor,
    input({
      projectId: undefined,
      refundOfId: p.id,
      purpose: "REVERSAL",
      method: "CORRECTION",
      reference: "Admin correction",
      note: "Incorrect receipt entry was approved for reversal",
      amount: "0.03"
    }),
    randomUUID()
  );
  assert.match(adjustment.number, /^SAR-ADJ-/);
  assert.deepEqual(await payRow(p.id), original);
  const detail = await payments.paymentDetail(admin, p.id);
  assert.equal(detail.payment.allocated, "0.97");
  assert.equal(detail.balance.refunded, "0");
  assert.equal(detail.balance.reversed, "0.03");
  assert.equal(detail.balance.net, "0.97");
  const snapshot = (
    await owner.query("SELECT snapshot FROM sarathi.payment_documents WHERE payment_id=$1", [
      adjustment.id
    ])
  ).rows[0].snapshot;
  assert.equal(snapshot.purpose, "REVERSAL");
  await assert.rejects(
    payments.recordPayment(
      scope("payments.refund"),
      actor,
      input({
        projectId: undefined,
        refundOfId: p.id,
        purpose: "REVERSAL",
        method: "CORRECTION",
        reference: "Second correction",
        note: "Correction exceeds receipt",
        amount: "0.98"
      }),
      randomUUID()
    ),
    /exceeds/
  );
});
test("different concurrent payments receive unique numbers", async () => {
  const [a, b] = await Promise.all([receipt(), receipt()]);
  assert.notEqual(a.number, b.number);
});
test("large ledger sums remain exact even when their aggregate exceeds a single-entry limit", async () => {
  const q = await accepted();
  await receipt({ projectId: undefined, quotationId: q.id, amount: "999999999999.99" });
  const p = await receipt({ projectId: undefined, quotationId: q.id, amount: "999999999999.99" });
  const balance = (await payments.paymentDetail(admin, p.id)).balance;
  assert.equal(balance.received, "1999999999999.98");
  assert.equal(balance.credit, "1999999999899.97");
});
test("interrupted-submission lookup is scoped to the authenticated recorder and organization", async () => {
  const key = randomUUID(),
    p = await receipt({ amount: "1.00" }, key);
  assert.equal((await payments.findPaymentSubmission(admin, key))?.id, p.id);
  assert.equal(await payments.findPaymentSubmission(foreign, key), null);
  assert.equal(await payments.findPaymentSubmission(operator, key), null);
  await assert.rejects(payments.findPaymentSubmission(viewer, key), AccessDeniedError);
  const allocationKey = randomUUID();
  // A project advance can be allocated to the accepted project baseline later.
  const fresh = await business.createProject(scope("projects.create"), actor, {
    customerId: customer.id,
    name: "Allocation retry QA project",
    siteAddress: "Bhayandar",
    serviceTypes: ["cctv"]
  });
  const advance = await receipt({ projectId: fresh.id, amount: "1.00" });
  const quote = await accepted(fresh.id);
  await payments.allocatePayment(
    scope("payments.allocate"),
    advance.id,
    quote.id,
    "0.10",
    allocationKey
  );
  assert.equal((await payments.findAllocationSubmission(admin, allocationKey))?.id, advance.id);
  assert.equal(await payments.findAllocationSubmission(foreign, allocationKey), null);
  assert.equal(await payments.findAllocationSubmission(operator, allocationKey), null);
});
test("project advances show no invented amount due before a baseline exists", async () => {
  const p = await receipt({ amount: "1.23" }),
    detail = await payments.paymentDetail(admin, p.id);
  assert.equal(detail.balance.total, null);
  assert.equal(detail.balance.outstanding, null);
  assert.equal(detail.remaining.unallocated, "1.23");
  assert.equal(
    (await owner.query("SELECT operational_status FROM sarathi.projects WHERE id=$1", [project.id]))
      .rows[0].operational_status,
    "SURVEY_PENDING"
  );
});
let baseline: string;
test("advances allocate partially with keyed retry protection and cannot exceed capacity", async () => {
  baseline = (await accepted(project.id)).id;
  const p = await receipt({ amount: "10.01" }),
    key = randomUUID();
  await Promise.all([
    payments.allocatePayment(scope("payments.allocate"), p.id, baseline, "4.01", key),
    payments.allocatePayment(scope("payments.allocate"), p.id, baseline, "4.01", key)
  ]);
  assert.equal((await payments.readPayment(scope("payments.read"), p.id)).allocated, "4.01");
  await assert.rejects(
    payments.allocatePayment(scope("payments.allocate"), p.id, baseline, "4.02", key),
    /different details/
  );
  await assert.rejects(
    payments.allocatePayment(scope("payments.allocate"), p.id, baseline, "6.01", randomUUID()),
    /exceeds/
  );
  await payments.allocatePayment(scope("payments.allocate"), p.id, baseline, "6.00", randomUUID());
  assert.equal((await payments.paymentDetail(admin, p.id)).remaining.unallocated, "0.00");
});
test("concurrent allocations serialize and prevent over-allocation", async () => {
  const p = await receipt({ amount: "10.00" });
  const results = await Promise.allSettled([
    payments.allocatePayment(scope("payments.allocate"), p.id, baseline, "8.00", randomUUID()),
    payments.allocatePayment(scope("payments.allocate"), p.id, baseline, "8.00", randomUUID())
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
test("quotation-linked receipts automatically allocate once and exact refunds append reversals", async () => {
  const p = await receipt({ quotationId: baseline, amount: "10.01" });
  assert.equal((await payments.readPayment(scope("payments.read"), p.id)).allocated, "10.01");
  const key = randomUUID();
  const [a, b] = await Promise.all([refund(p.id, "3.02", key), refund(p.id, "3.02", key)]);
  assert.equal(a.id, b.id);
  const detail = await payments.paymentDetail(admin, p.id);
  assert.equal(detail.payment.refunded, "3.02");
  assert.equal(detail.payment.allocated, "6.99");
  assert.equal(detail.remaining.unallocated, "0.00");
  assert.equal(detail.remaining.refundable, "6.99");
  assert.ok(detail.events.some((e) => e.event === "ALLOCATION_REFUNDED" && e.amount === "-3.02"));
  await assert.rejects(refund(a.id, "0.01"), /current receipt/);
  await assert.rejects(refund(p.id, "7.00"), /exceeds/);
});
test("refunds consume unallocated credit first before reversing allocations", async () => {
  const p = await receipt({ amount: "10.00" });
  await payments.allocatePayment(scope("payments.allocate"), p.id, baseline, "7.00", randomUUID());
  await refund(p.id, "2.00");
  assert.equal((await payments.readPayment(scope("payments.read"), p.id)).allocated, "7.00");
  await refund(p.id, "2.00");
  assert.equal((await payments.readPayment(scope("payments.read"), p.id)).allocated, "6.00");
  const detail = await payments.paymentDetail(admin, p.id);
  assert.equal(detail.events.filter((e) => e.event === "REFUND" && e.paymentId !== p.id).length, 2);
});
test("concurrent refunds cannot exceed the original receipt", async () => {
  const p = await receipt({ amount: "2.00" });
  const results = await Promise.allSettled([refund(p.id, "1.51"), refund(p.id, "1.51")]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await payments.readPayment(scope("payments.read"), p.id)).refunded, "1.51");
});
test("all divisions support accepted standalone quotation receipts and customer links", async () => {
  for (const d of (
    await owner.query("SELECT id::text FROM sarathi.divisions WHERE organization_id=$1", [org])
  ).rows) {
    const q = await accepted(null, d.id, "20.01"),
      p = await receipt({ projectId: undefined, quotationId: q.id, amount: "25.02" });
    const detail = await payments.paymentDetail(admin, p.id);
    assert.equal(detail.payment.projectId, null);
    assert.equal(detail.balance.outstanding, "0.00");
    assert.equal(detail.balance.credit, "5.01");
    const profile = await getCustomerProfile(admin, customer.id, { section: "payments" });
    assert.ok(profile?.items.some((row) => row.id === p.id));
  }
});
test("accepted revisions change the commercial baseline but preserve payments and PDFs", async () => {
  const q = await accepted(null, smart, "20.00"),
    p = await receipt({ projectId: undefined, quotationId: q.id, amount: "10.00" }),
    before = await payments.paymentPdf(admin, p.id);
  const revision = await quotes.reviseQuote(scope("quotations.create"), actor, q.id, randomUUID());
  await quotes.editDraft(
    scope("quotations.update"),
    {
      customerId: customer.id,
      divisionId: smart,
      title: "Revised commercial basis",
      siteAddress: "",
      discount: "0",
      taxMode: "NONE",
      validUntil: "2099-12-31",
      terms: "Revised by staff",
      items: [
        { description: "Service", quantity: "1", unit: "each", rate: "30.00", taxPercent: "0" }
      ]
    },
    revision.id,
    "1"
  );
  await quotes.issueQuote(scope("quotations.update"), actor, revision.id, "2");
  await quotes.decideQuote(scope("quotations.update"), actor, revision.id, true, {
    reason: "Staff confirmed revised terms",
    acknowledge: true
  });
  const detail = await payments.paymentDetail(admin, p.id);
  assert.equal(detail.balance.total, "30.00");
  assert.equal(detail.balance.outstanding, "20.00");
  assert.equal(detail.balance.received, "10.00");
  assert.ok((await payments.paymentPdf(admin, p.id))!.pdf.equals(before!.pdf));
  await refund(p.id, "2.00");
  assert.equal((await payments.paymentDetail(admin, p.id)).balance.outstanding, "22.00");
});
test("viewer and ordinary operators cannot record money; authorized operators cannot refund", async () => {
  for (const h of [viewer, operator, new Headers()])
    await assert.rejects(payments.savePayment(h, input(), randomUUID()), AccessDeniedError);
  await owner.query(
    "UPDATE sarathi.organization_memberships SET can_record_payments=true WHERE organization_id=$1 AND user_id=$2",
    [org, op]
  );
  try {
    const p = await payments.savePayment(operator, input({ amount: "1.00" }), randomUUID());
    assert.ok(p.id);
    await assert.rejects(
      payments.savePayment(
        operator,
        input({
          projectId: undefined,
          refundOfId: p.id,
          purpose: "REFUND",
          note: "Already refunded"
        }),
        randomUUID()
      ),
      AccessDeniedError
    );
  } finally {
    await owner.query(
      "UPDATE sarathi.organization_memberships SET can_record_payments=false WHERE organization_id=$1 AND user_id=$2",
      [org, op]
    );
  }
});
test("foreign tenants and unassigned divisions cannot read or mutate payments or download PDFs", async () => {
  const digital = (
    await owner.query(
      "SELECT id::text FROM sarathi.divisions WHERE organization_id=$1 AND slug='digital-seva-kendra'",
      [org]
    )
  ).rows[0].id;
  const q = await accepted(null, digital),
    p = await receipt({ projectId: undefined, quotationId: q.id });
  for (const h of [foreign, operator]) {
    await assert.rejects(payments.paymentDetail(h, p.id));
    assert.equal(await payments.paymentPdf(h, p.id), null);
    assert.equal(
      (
        await fetch(process.env.OPERATIONS_TEST_URL + "/api/admin/payments/" + p.id + "/pdf", {
          headers: h
        })
      ).status,
      404
    );
    await assert.rejects(
      payments.savePayment(h, input({ projectId: undefined, quotationId: q.id }), randomUUID())
    );
  }
  assert.equal(
    (await fetch(process.env.OPERATIONS_TEST_URL + "/api/admin/payments/" + p.id + "/pdf")).status,
    403
  );
  assert.equal(
    (
      await fetch(process.env.OPERATIONS_TEST_URL + "/api/admin/payments/" + p.id + "/pdf", {
        headers: viewer
      })
    ).status,
    403
  );
});
test("receipt download is an immutable private attachment after contact edits and refunds", async () => {
  const p = await receipt({ amount: "1.00" }),
    before = await payments.paymentPdf(admin, p.id);
  const version = (
    await owner.query("SELECT version FROM sarathi.customers WHERE id=$1", [customer.id])
  ).rows[0].version;
  await business.updateCustomer(
    scope("customers.update"),
    customer.id,
    { name: "Updated payment customer", phone: "9876543210" },
    String(version)
  );
  await refund(p.id, "0.50");
  assert.ok((await payments.paymentPdf(admin, p.id))!.pdf.equals(before!.pdf));
  const response = await fetch(
    process.env.OPERATIONS_TEST_URL + "/api/admin/payments/" + p.id + "/pdf",
    { headers: admin }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-disposition")!, /^attachment;/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(before!.pdf));
});
test("raw and viewer reads remain empty and actor forgery is denied", async () => {
  assert.equal((await runtime.query("SELECT * FROM sarathi.payments")).rowCount, 0);
  assert.equal(
    (
      await scope("dashboard.read", await actorFor("viewer@example.test")).query(
        "SELECT * FROM sarathi.payment_documents"
      )
    ).rowCount,
    0
  );
  await assert.rejects(
    payments.recordPayment(scope("payments.create"), op, input(), randomUUID()),
    /actor/
  );
  await assert.rejects(
    scope("payments.create").query(
      "INSERT INTO sarathi.payments(project_id,kind,amount,idempotency_key,payment_method,occurred_at) VALUES($1,'RECEIPT',1,'missing-key','CASH',now())",
      [project.id]
    )
  );
});
test("direct scoped SQL cannot commit a current payment without its private document", async () => {
  const key = randomUUID();
  await assert.rejects(
    scope("payments.create").query(
      `INSERT INTO sarathi.payments(project_id,customer_id,division_id,kind,amount,idempotency_key,payment_method,occurred_at,purpose,creation_request_id,creation_request_hash) VALUES($1,$2,$3,'RECEIPT',1,$4,'CASH',now(),'ADVANCE',$5,$6)`,
      [project.id, customer.id, smart, "direct-" + key, key, "a".repeat(64)]
    )
  );
  assert.equal(
    (await owner.query("SELECT 1 FROM sarathi.payments WHERE creation_request_id=$1", [key]))
      .rowCount,
    0
  );
});
test("document generation failure rolls back ledger, allocation, counter and audit", async () => {
  const count = await paymentCount(),
    before = (
      await owner.query(
        "SELECT last_number::text FROM sarathi.payment_counters ORDER BY division_id"
      )
    ).rows;
  await assert.rejects(
    payments.recordPayment(
      scope("payments.create"),
      actor,
      input({ quotationId: baseline }),
      randomUUID(),
      async () => {
        throw new Error("Synthetic PDF failure");
      }
    ),
    /Synthetic/
  );
  assert.equal(await paymentCount(), count);
  assert.deepEqual(
    (
      await owner.query(
        "SELECT last_number::text FROM sarathi.payment_counters ORDER BY division_id"
      )
    ).rows,
    before
  );
});
test("artifact storage or audit failure rolls back the entire receipt", async () => {
  for (const table of ["payment_documents", "payment_events"]) {
    const count = await paymentCount();
    await owner.query(
      `CREATE FUNCTION sarathi.payment_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic payment failure'; END $$; CREATE TRIGGER payment_test_failure BEFORE INSERT ON sarathi.${table} FOR EACH ROW EXECUTE FUNCTION sarathi.payment_test_failure()`
    );
    try {
      await assert.rejects(receipt({ quotationId: baseline }));
      assert.equal(await paymentCount(), count);
    } finally {
      await owner.query(
        `DROP TRIGGER payment_test_failure ON sarathi.${table}; DROP FUNCTION sarathi.payment_test_failure()`
      );
    }
  }
});
test("runtime and privileged maintenance cannot rewrite financial, allocation, document or audit history", async () => {
  const p = await receipt({ quotationId: baseline });
  for (const sql of [
    "UPDATE sarathi.payments SET amount=1 WHERE id=$1",
    "DELETE FROM sarathi.payments WHERE id=$1",
    "UPDATE sarathi.payment_documents SET snapshot='{}' WHERE payment_id=$1",
    "DELETE FROM sarathi.payment_allocations WHERE receipt_id=$1",
    "DELETE FROM sarathi.payment_events WHERE payment_id=$1"
  ]) {
    await assert.rejects(owner.query(sql, [p.id]));
    await assert.rejects(scope("payments.create").query(sql, [p.id]));
  }
  await assert.rejects(owner.query("TRUNCATE sarathi.payment_events"));
});
test("allocations cannot move money to another project or standalone family", async () => {
  const p = await receipt({ amount: "1.00" }),
    q = await accepted();
  await assert.rejects(
    payments.allocatePayment(scope("payments.allocate"), p.id, q.id, "0.01", randomUUID())
  );
  const standalone = await receipt({ projectId: undefined, quotationId: q.id, amount: "1.00" }),
    other = await accepted();
  await assert.rejects(
    payments.allocatePayment(
      scope("payments.allocate"),
      standalone.id,
      other.id,
      "0.01",
      randomUUID()
    )
  );
});
test("history is bounded and paginates without duplicate events", async () => {
  const p = await receipt({ amount: "1.00" });
  for (let i = 0; i < 53; i++)
    await payments.allocatePayment(
      scope("payments.allocate"),
      p.id,
      baseline,
      "0.01",
      randomUUID()
    );
  const first = await payments.paymentDetail(admin, p.id);
  assert.equal(first.events.length, 50);
  assert.ok(first.next);
  const second = await payments.paymentDetail(admin, p.id, first.next!);
  assert.equal(second.events.length, 4);
  assert.ok(!second.events.some((e) => first.events.some((f) => e.id === f.id)));
});
test("previously resolved payment scopes fail closed after membership revocation", async () => {
  const stale = scope("payments.read"),
    p = await receipt();
  await owner.query(
    "UPDATE sarathi.organization_memberships SET active=false WHERE organization_id=$1 AND user_id=$2",
    [org, actor]
  );
  try {
    await assert.rejects(payments.readPayment(stale, p.id), AccessDeniedError);
  } finally {
    await owner.query(
      "UPDATE sarathi.organization_memberships SET active=true WHERE organization_id=$1 AND user_id=$2",
      [org, actor]
    );
  }
});
test("direct HTTP payment actions reject forged scope, viewer, operator, foreign and anonymous requests", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../.next/server/server-reference-manifest.json", import.meta.url),
      "utf8"
    )
  );
  const entry = Object.entries(manifest.node).find(
    ([, v]) => (v as { exportedName: string }).exportedName === "savePaymentAction"
  );
  assert.ok(entry);
  const count = await paymentCount();
  for (const h of [viewer, operator, foreign, new Headers()]) {
    const body = new FormData();
    body.set("0", JSON.stringify([input(), randomUUID()]));
    const hs = new Headers(h);
    hs.set("Accept", "text/x-component");
    hs.set("Origin", process.env.OPERATIONS_TEST_URL!);
    hs.set("Next-Action", entry[0]);
    hs.set("x-sarathi-organization-id", org);
    const response = await fetch(process.env.OPERATIONS_TEST_URL + "/admin/payments/new", {
      method: "POST",
      headers: hs,
      body,
      redirect: "manual"
    });
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.ok(text.includes('"error":'));
    assert.ok(!text.includes('"id":'));
  }
  assert.equal(await paymentCount(), count);
});
test("migration 010 preserves legacy rows and rolls back atomically on injected failure", async () => {
  const db = "payment_upgrade_" + randomUUID().replaceAll("-", "");
  await owner.query('CREATE DATABASE "' + db + '"');
  const url = new URL(process.env.DATABASE_MIGRATION_URL!);
  url.pathname = "/" + db;
  const client = new pg.Client({ connectionString: url.toString() });
  try {
    await client.connect();
    const directory = new URL("../../database/migrations/", import.meta.url);
    for (const file of (await readdir(directory)).filter((f) => /^00[1-9]_.*\.sql$/.test(f)).sort())
      await client.query(await readFile(new URL(file, directory), "utf8"));
    await client.query(
      `INSERT INTO sarathi.users(identity_subject,display_name,role) VALUES('legacy-payment','Legacy actor','ADMIN'); INSERT INTO sarathi.organization_memberships(organization_id,user_id,role) VALUES(1,1,'ADMIN'); INSERT INTO sarathi.customers(name,phone) VALUES('Legacy customer','9876543210'); INSERT INTO sarathi.projects(customer_id,name,site_address) VALUES(1,'Legacy project','Bhayandar'); INSERT INTO sarathi.payments(project_id,kind,amount,idempotency_key,payment_method,occurred_at,recorded_by,note) VALUES(1,'RECEIPT',10.01,'legacy-receipt','CASH','2025-01-01',1,'Original payment'),(1,'REFUND',1.01,'legacy-refund','CASH','2025-01-02',1,'Original refund');`
    );
    const before = (await client.query("SELECT * FROM sarathi.payments ORDER BY id")).rows,
      migration = await readFile(new URL("010_payment_management.sql", directory), "utf8");
    await assert.rejects(
      client.query(
        migration.replace(
          "INSERT INTO sarathi.schema_migrations(version,name)",
          "SELECT 1/0; INSERT INTO sarathi.schema_migrations(version,name)"
        )
      )
    );
    await client.query("ROLLBACK");
    assert.equal(
      (await client.query("SELECT to_regclass('sarathi.payment_documents') AS t")).rows[0].t,
      null
    );
    await client.query(migration);
    const rows = (await client.query("SELECT * FROM sarathi.payments ORDER BY id")).rows;
    for (let i = 0; i < before.length; i++)
      assert.deepEqual(
        Object.fromEntries(Object.keys(before[i]).map((k) => [k, rows[i][k]])),
        before[i]
      );
    assert.equal((await client.query("SELECT * FROM sarathi.payment_documents")).rowCount, 0);
    await assert.rejects(client.query("UPDATE sarathi.payments SET note='Changed' WHERE id=1"));
  } finally {
    await client.end();
    await owner.query('DROP DATABASE "' + db + '"');
  }
});
