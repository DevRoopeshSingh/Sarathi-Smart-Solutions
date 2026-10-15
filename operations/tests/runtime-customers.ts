import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { tenantPool } from "../src/server/tenant-pool";
import * as business from "../src/server/business";
import * as dal from "../src/server/dal";
import { DuplicateCustomerError } from "../src/server/customer-mutations";
import { getCustomerProfile } from "../src/server/customers";
import { getListPage, customerOptions } from "../src/server/lists";
import { normalizeCustomerPhone } from "../src/lib/customer-contact";
import { getPool } from "../src/server/db";
import { AccessDeniedError } from "../src/server/mutation-errors";
if (process.env.OPERATIONS_TEST_ISOLATED !== "1") throw new Error("Use the isolated harness.");
const owner = new pg.Pool({ connectionString: process.env.DATABASE_MIGRATION_URL });
const runtime = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
after(async () => {
  await owner.end();
  await runtime.end();
  await getPool().end();
});
const origin = process.env.OPERATIONS_TEST_URL!;
async function actor(email: string) {
  return (
    await owner.query(
      `SELECT u.id::text FROM sarathi.users u JOIN sarathi.auth_users a ON a.id=u.identity_subject WHERE a.email=$1`,
      [email]
    )
  ).rows[0].id as string;
}
const admin = await actor("admin@example.test"),
  operator = await actor("operator@example.test"),
  viewer = await actor("viewer@example.test"),
  foreign = await actor("b-admin@example.test");
const org = (await owner.query(`SELECT id::text FROM sarathi.organizations WHERE slug='sarathi'`))
  .rows[0].id;
const orgB = (
  await owner.query(`SELECT id::text FROM sarathi.organizations WHERE slug='isolation-b'`)
).rows[0].id;
const divisions = (
  await owner.query(`SELECT id::text,slug FROM sarathi.divisions WHERE organization_id=$1`, [org])
).rows;
const smart = divisions.find((d) => d.slug === "smart-solutions").id,
  digital = divisions.find((d) => d.slug === "digital-seva-kendra").id;
const scope = (permission: Parameters<typeof tenantPool>[3], who = admin, organization = org) =>
  tenantPool(runtime, who, organization, permission);
async function login(email: string) {
  await owner.query("DELETE FROM sarathi.auth_ratelimits");
  const response = await fetch(origin + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
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
const adminHeaders = await login("admin@example.test"),
  operatorHeaders = await login("operator@example.test"),
  viewerHeaders = await login("viewer@example.test"),
  foreignHeaders = await login("b-admin@example.test");
const input = {
  name: "Customer V2 profile",
  phone: "+91 98300 12345",
  email: "owner@example.test",
  address: "Mumbai"
};
const customer = await business.createCustomer(scope("customers.create"), input);
const foreignCustomer = await business.createCustomer(scope("customers.create", foreign, orgB), {
  name: "PRIVATE foreign matching contact",
  phone: input.phone
});
const projects: string[] = [];
const quotes: string[] = [];
for (const [division, label] of [
  [smart, "Smart visible"],
  [digital, "Digital restricted"]
]) {
  const lead = (
    await owner.query(
      `INSERT INTO sarathi.leads(organization_id,division_id,customer_id,contact_name,phone,service_requested,status) VALUES($1,$2,$3,$4,'9830012345','CCTV','CONVERTED') RETURNING id::text`,
      [org, division, customer.id, label]
    )
  ).rows[0].id;
  const project = (
    await owner.query(
      `INSERT INTO sarathi.projects(organization_id,division_id,customer_id,lead_id,name,site_address,scope,service_types) VALUES($1,$2,$3,$4,$5,'Mumbai','Existing scope',ARRAY['network','legacy-service']) RETURNING id::text`,
      [org, division, customer.id, lead, label]
    )
  ).rows[0].id;
  projects.push(project);
  await owner.query(
    `INSERT INTO sarathi.status_history(organization_id,project_id,to_status,was_on_hold,is_on_hold,reason,changed_by) VALUES($1,$2,'SURVEY_PENDING',false,false,$3,$4)`,
    [org, project, label + " history", admin]
  );
  const quote = (
    await owner.query(
      `INSERT INTO sarathi.quotations(organization_id,project_id,customer_id,version,created_by,customer_name,customer_phone,site_address,subtotal,total,recommended_advance,terms,valid_until) VALUES($1,$2,$3,1,$4,$5,$6,'Mumbai',100.10,100.10,10.01,'Existing terms',CURRENT_DATE+30) RETURNING id::text`,
      [org, project, customer.id, admin, input.name, input.phone]
    )
  ).rows[0].id;
  quotes.push(quote);
  await owner.query(
    `UPDATE sarathi.quotations SET status='SENT',frozen_at=now(),sent_at=now() WHERE id=$1`,
    [quote]
  );
  await owner.query(
    `INSERT INTO sarathi.payments(organization_id,project_id,quotation_id,kind,amount,idempotency_key,payment_method,occurred_at,recorded_by) VALUES($1,$2,$3,'RECEIPT',10.01,$4,'CASH',now(),$5)`,
    [org, project, quote, randomUUID(), admin]
  );
}

test("SQL generated phones match client canonicalization without altering legacy formatting", async () => {
  for (const phone of [
    "9820098200",
    "+91 98200-98200",
    "0091 9820098200",
    "09820098200",
    "022-12345678",
    "+44 (20) 1234 5678"
  ]) {
    const result = await owner.query(`SELECT sarathi.normalize_customer_phone($1) AS phone`, [
      phone
    ]);
    assert.equal(result.rows[0].phone, normalizeCustomerPhone(phone));
  }
  const result = await owner.query(
    `SELECT phone,normalized_phone FROM sarathi.customers WHERE id=$1`,
    [customer.id]
  );
  assert.equal(result.rows[0].phone, input.phone);
  assert.equal(result.rows[0].normalized_phone, "9830012345");
});
test("exact phone and similar name warnings are deterministic, bounded, and organization-only", async () => {
  for (const patch of [
    { phone: "09830012345", name: "Different contact" },
    { phone: "9840012345", name: "Customer V2 profile branch" }
  ]) {
    const requestId = randomUUID();
    await assert.rejects(
      business.createCustomer(
        scope("customers.create"),
        { ...input, ...patch },
        { requestId, confirmDuplicates: false }
      ),
      (error: unknown) => {
        assert.ok(error instanceof DuplicateCustomerError);
        assert.ok(error.duplicates.length <= 10);
        assert.ok(
          error.duplicates.some(
            (d) =>
              d.id === customer.id && d.match === (patch.phone === "09830012345" ? "PHONE" : "NAME")
          )
        );
        assert.ok(!JSON.stringify(error.duplicates).includes("PRIVATE"));
        assert.ok(!error.duplicates.some((d) => d.id === foreignCustomer.id));
        return true;
      }
    );
    assert.equal(
      (
        await owner.query(
          `SELECT count(*)::int AS count FROM sarathi.customers WHERE creation_request_id=$1`,
          [requestId]
        )
      ).rows[0].count,
      0
    );
  }
});
test("explicit separate-customer override and identical retries create exactly one record", async () => {
  const requestId = randomUUID();
  const options = { requestId, confirmDuplicates: true };
  const rows = await Promise.all([
    business.createCustomer(scope("customers.create"), input, options),
    business.createCustomer(scope("customers.create"), input, options)
  ]);
  assert.equal(rows[0].id, rows[1].id);
  assert.notEqual(rows[0].id, customer.id);
  assert.equal(
    (
      await owner.query(
        `SELECT count(*)::int AS count FROM sarathi.customers WHERE creation_request_id=$1`,
        [requestId]
      )
    ).rows[0].count,
    1
  );
  await assert.rejects(
    business.createCustomer(
      scope("customers.create"),
      { ...input, name: "Changed retry" },
      options
    ),
    /already used/
  );
});
test("concurrent independent submissions serialize phone checks rather than accidentally duplicate", async () => {
  const data = { name: "Independent unique submission", phone: "9850012345" };
  const results = await Promise.allSettled([
    business.createCustomer(scope("customers.create"), data, {
      requestId: randomUUID(),
      confirmDuplicates: false
    }),
    business.createCustomer(scope("customers.create"), data, {
      requestId: randomUUID(),
      confirmDuplicates: false
    })
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
  assert.ok(failure.reason instanceof DuplicateCustomerError);
});
test("valid operator edits preserve IDs and relationships and audit only changed fields", async () => {
  await dal.updateCustomer(
    operatorHeaders,
    customer.id,
    { ...input, name: "Updated customer V2", email: "", address: "" },
    "1"
  );
  const record = (
    await owner.query(`SELECT name,version,email,address FROM sarathi.customers WHERE id=$1`, [
      customer.id
    ])
  ).rows[0];
  assert.equal(record.version, 2);
  assert.equal(record.email, null);
  assert.equal(record.address, null);
  const audit = (
    await owner.query(
      `SELECT changed_by::text,changed_fields FROM sarathi.customer_changes WHERE customer_id=$1`,
      [customer.id]
    )
  ).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].changed_by, operator);
  assert.deepEqual(audit[0].changed_fields, ["name", "email", "address"]);
  assert.equal(
    (
      await owner.query(
        `SELECT count(*)::int AS count FROM sarathi.projects WHERE customer_id=$1 AND id=ANY($2::bigint[])`,
        [customer.id, projects]
      )
    ).rows[0].count,
    2
  );
  const frozen = (
    await owner.query(
      `SELECT customer_name,total::text FROM sarathi.quotations WHERE id=ANY($1::bigint[])`,
      [quotes]
    )
  ).rows;
  assert.ok(frozen.every((q) => q.customer_name === input.name && q.total === "100.10"));
});
test("invalid contacts, missing versions, and stale edits never write or audit", async () => {
  for (const [data, version] of [
    [{ ...input, phone: "abc" }, "2"],
    [{ ...input, email: "bad" }, "2"],
    [input, "0"],
    [input, "1"]
  ] as const)
    await assert.rejects(dal.updateCustomer(adminHeaders, customer.id, data, version));
  assert.equal(
    (await owner.query(`SELECT version FROM sarathi.customers WHERE id=$1`, [customer.id])).rows[0]
      .version,
    2
  );
  assert.equal(
    (
      await owner.query(
        `SELECT count(*)::int AS count FROM sarathi.customer_changes WHERE customer_id=$1`,
        [customer.id]
      )
    ).rows[0].count,
    1
  );
});
test("concurrent edits allow one winner and no-op saves do not inflate audit history", async () => {
  const edits = await Promise.allSettled([
    business.updateCustomer(
      scope("customers.update"),
      customer.id,
      { ...input, name: "Concurrent A" },
      "2"
    ),
    business.updateCustomer(
      scope("customers.update"),
      customer.id,
      { ...input, name: "Concurrent B" },
      "2"
    )
  ]);
  assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
  const saved = (
    await owner.query(
      `SELECT name,phone,email,address,version FROM sarathi.customers WHERE id=$1`,
      [customer.id]
    )
  ).rows[0];
  assert.equal(saved.version, 3);
  await business.updateCustomer(scope("customers.update"), customer.id, saved, "3");
  assert.equal(
    (
      await owner.query(
        `SELECT count(*)::int AS count FROM sarathi.customer_changes WHERE customer_id=$1`,
        [customer.id]
      )
    ).rows[0].count,
    2
  );
});
test("failed audit insertion rolls back customer contact and version changes", async () => {
  await owner.query(
    `ALTER TABLE sarathi.customer_changes ADD CONSTRAINT fixture_reject_customer_audit CHECK(customer_id<>${customer.id}) NOT VALID`
  );
  const before = (
    await owner.query(`SELECT name,version,updated_at FROM sarathi.customers WHERE id=$1`, [
      customer.id
    ])
  ).rows[0];
  try {
    await assert.rejects(
      business.updateCustomer(
        scope("customers.update"),
        customer.id,
        { ...input, name: "Must roll back" },
        "3"
      ),
      (error: unknown) => (error as { code: string }).code === "23514"
    );
    const after = (
      await owner.query(`SELECT name,version,updated_at FROM sarathi.customers WHERE id=$1`, [
        customer.id
      ])
    ).rows[0];
    assert.deepEqual(after, before);
  } finally {
    await owner.query(
      `ALTER TABLE sarathi.customer_changes DROP CONSTRAINT fixture_reject_customer_audit`
    );
  }
});

test("viewer, inactive membership, and foreign-ID edits fail closed", async () => {
  await assert.rejects(
    dal.updateCustomer(viewerHeaders, customer.id, input, "3"),
    AccessDeniedError
  );
  await assert.rejects(
    dal.updateCustomer(adminHeaders, foreignCustomer.id, input, "1"),
    /unavailable/
  );
  await assert.rejects(
    business.updateCustomer(scope("customers.update", viewer), customer.id, input, "3"),
    AccessDeniedError
  );
  await owner.query(
    `UPDATE sarathi.organization_memberships SET active=false WHERE organization_id=$1 AND user_id=$2`,
    [org, operator]
  );
  try {
    await assert.rejects(
      dal.updateCustomer(operatorHeaders, customer.id, input, "3"),
      AccessDeniedError
    );
  } finally {
    await owner.query(
      `UPDATE sarathi.organization_memberships SET active=true WHERE organization_id=$1 AND user_id=$2`,
      [org, operator]
    );
  }
  assert.equal(await getCustomerProfile(adminHeaders, foreignCustomer.id), null);
  assert.equal(await getCustomerProfile(foreignHeaders, customer.id), null);
});
test("database guards prohibit ownership/version changes and audit mutation or forgery", async () => {
  assert.equal(
    (await runtime.query(`UPDATE sarathi.customers SET name='unscoped' WHERE id=$1`, [customer.id]))
      .rowCount,
    0
  );
  for (const sql of [
    `UPDATE sarathi.customers SET organization_id=2`,
    `UPDATE sarathi.customers SET version=99`,
    `UPDATE sarathi.customer_changes SET changed_by=1`,
    `DELETE FROM sarathi.customer_changes`,
    `INSERT INTO sarathi.customer_changes(organization_id,customer_id,customer_version,changed_fields) VALUES(1,1,1,ARRAY['name'])`
  ])
    await assert.rejects(
      runtime.query(sql),
      (e: unknown) => (e as { code: string }).code === "42501"
    );
  await assert.rejects(
    owner.query(`UPDATE sarathi.customer_changes SET customer_version=99 WHERE customer_id=$1`, [
      customer.id
    ]),
    (e: unknown) => (e as { code: string }).code === "23514"
  );
});
test("profiles restrict division-linked leads, services, activity, quotations, and payments", async () => {
  for (const section of ["projects", "leads", "activity", "quotes", "payments"]) {
    const adminProfile = await getCustomerProfile(adminHeaders, customer.id, { section });
    assert.ok(adminProfile);
    assert.ok(JSON.stringify(adminProfile.items).includes("Digital restricted"));
    const operatorProfile = await getCustomerProfile(operatorHeaders, customer.id, { section });
    assert.ok(operatorProfile);
    assert.ok(JSON.stringify(operatorProfile.items).includes("Smart visible"));
    assert.ok(!JSON.stringify(operatorProfile.items).includes("Digital restricted"));
  }
  const profile = await getCustomerProfile(operatorHeaders, customer.id);
  assert.equal(profile!.customer.projectCount, 1);
  assert.deepEqual(profile!.items[0].services, ["network", "legacy-service"]);
  await assert.rejects(
    getCustomerProfile(viewerHeaders, customer.id, { section: "payments" }),
    AccessDeniedError
  );
  assert.equal((await getCustomerProfile(viewerHeaders, customer.id))!.canEdit, false);
});
test("customer history uses bounded stable pagination without missing or duplicating rows", async () => {
  await owner.query(
    `INSERT INTO sarathi.status_history(organization_id,project_id,to_status,was_on_hold,is_on_hold,reason,changed_by,changed_at)
    SELECT $1,$2,'SURVEY_COMPLETE',false,false,'Paging history ' || n,$3,now()-n*interval '1 second' FROM generate_series(1,31)n`,
    [org, projects[0], admin]
  );
  const first = await getCustomerProfile(operatorHeaders, customer.id, { section: "activity" });
  assert.equal(first!.items.length, 25);
  assert.ok(first!.next);
  const second = await getCustomerProfile(operatorHeaders, customer.id, {
    section: "activity",
    after: first!.next!
  });
  assert.ok(second!.items.length > 0);
  assert.equal(second!.next, null);
  const all = [...first!.items, ...second!.items];
  assert.equal(new Set(all.map((v) => v.source + ":" + v.id)).size, all.length);
  assert.equal(all.filter((v) => v.detail?.startsWith("Paging history")).length, 31);
  await assert.rejects(
    getCustomerProfile(adminHeaders, customer.id, { section: "activity", after: "garbage" }),
    /Invalid history page/
  );
});
test("normalized search, customer selectors, and visible-project filters stay scoped", async () => {
  const result = await getListPage(scope("customers.read"), "customers", {
    q: "0091 98300 12345",
    status: "HAS_PROJECTS"
  });
  assert.ok(result.items.some((c) => c.id === customer.id));
  assert.ok(!result.items.some((c) => c.id === foreignCustomer.id));
  const options = await customerOptions(scope("customers.read"), "+91 98300-12345");
  assert.ok(options.some((c) => c.id === customer.id));
  assert.ok(!options.some((c) => c.id === foreignCustomer.id));
  const empty = await getListPage(scope("customers.read"), "customers", {
    q: customer.phone,
    status: "NO_PROJECTS"
  });
  assert.ok(!empty.items.some((c) => c.id === customer.id));
});
const manifest = JSON.parse(
  await readFile(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8")
);
async function action(name: string, fields: Record<string, string>, headers: Headers) {
  const entry = Object.entries(manifest.node).find(
    ([, value]) => (value as { exportedName: string }).exportedName === name
  );
  assert.ok(entry);
  const form = new FormData();
  // React's streaming decoder resolves the root as soon as it arrives: nested
  // FormData fields must precede the root, exactly as the installed encoder emits.
  for (const [key, value] of Object.entries(fields)) form.set("_1_" + key, value);
  form.set("0", '["$K1"]');
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "text/x-component");
  requestHeaders.set("Origin", origin);
  requestHeaders.set("Next-Action", entry[0]);
  const response = await fetch(origin + "/admin/customers", {
    method: "POST",
    headers: requestHeaders,
    body: form,
    redirect: "manual"
  });
  assert.equal(response.status, 200);
  return response.text();
}
test("direct HTTP customer actions reject viewer writes, foreign IDs, invalid input", async () => {
  const fields = { customerId: customer.id, version: "3", ...input };
  for (const [submitted, headers] of [
    [fields, viewerHeaders],
    [{ ...fields, customerId: foreignCustomer.id }, adminHeaders],
    [{ ...fields, phone: "bad" }, adminHeaders],
    [fields, new Headers()]
  ] as const) {
    const response = await action("updateCustomerAction", submitted, headers);
    assert.ok(response.includes('"error":'));
    assert.ok(!response.includes('"success":true'));
    assert.ok(!response.includes("PRIVATE"));
  }
  const response = await action(
    "createCustomerAction",
    { ...input, requestId: randomUUID(), confirmDuplicates: "false" },
    adminHeaders
  );
  assert.ok(
    response.includes('"duplicates":'),
    response.match(/"error":"([^"]*)"/)?.[1] ?? "Missing duplicates response"
  );
  assert.ok(!response.includes("PRIVATE"));
  await assert.rejects(dal.createCustomer(adminHeaders, input), /submission reference/);
});
test("unauthenticated customer profile HTTP redirects and foreign customer details are never rendered", async () => {
  const anonymous = await fetch(origin + `/admin/customers/${customer.id}`, { redirect: "manual" });
  assert.equal(anonymous.status, 307);
  const foreignPage = await fetch(origin + `/admin/customers/${foreignCustomer.id}`, {
    headers: adminHeaders
  });
  assert.equal(foreignPage.status, 404);
  assert.ok(!(await foreignPage.text()).includes("PRIVATE foreign matching contact"));
});
