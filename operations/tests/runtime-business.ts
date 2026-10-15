import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";
import { tenantPool } from "../src/server/tenant-pool";
import * as business from "../src/server/business";
import { InputError } from "../src/server/input";
import { getListPage, customerOptions, projectCounts } from "../src/server/lists";

if (process.env.OPERATIONS_TEST_ISOLATED !== "1") throw new Error("Use the isolated harness.");
const owner = new pg.Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, max: 1 });
const runtime = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
after(async () => {
  await runtime.end();
  await owner.end();
});
const actor = (
  await owner.query(
    "SELECT u.id::text FROM sarathi.users u JOIN sarathi.auth_users a ON a.id=u.identity_subject WHERE a.email='admin@example.test' AND u.active"
  )
).rows[0].id as string;
const org = (await owner.query("SELECT id::text FROM sarathi.organizations WHERE slug='sarathi'"))
  .rows[0].id;
const scope = (permission: Parameters<typeof tenantPool>[3]) =>
  tenantPool(runtime, actor, org, permission);
async function rejectHistoryDuring(work: () => Promise<void>) {
  await owner.query(`CREATE FUNCTION sarathi.fixture_history_failure() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'Injected audit failure' USING ERRCODE='23514'; END; $$;
 CREATE TRIGGER fixture_history_failure BEFORE INSERT ON sarathi.status_history FOR EACH ROW EXECUTE FUNCTION sarathi.fixture_history_failure()`);
  try {
    await work();
  } finally {
    await owner.query(
      "DROP TRIGGER fixture_history_failure ON sarathi.status_history; DROP FUNCTION sarathi.fixture_history_failure()"
    );
  }
}
const customerInput = { name: "Integration ग्राहक", phone: "+91 22 2345 6789" };
const leadInput = {
  contactName: "Integration lead",
  phone: "9999999999",
  serviceRequested: "CCTV"
};
const projectInput = { name: "Integration project", siteAddress: "Mumbai", serviceTypes: ["cctv"] };

test("restricted runtime creates and converts records with exact bigint IDs and audit history", async () => {
  const customer = await business.createCustomer(scope("customers.create"), customerInput);
  assert.equal(typeof customer.id, "string");
  await owner.query(`INSERT INTO sarathi.leads (id,contact_name,phone,service_requested)
    OVERRIDING SYSTEM VALUE VALUES (9007199254740993,'Large ID lead','9999999999','CCTV')`);
  const project = await business.createProject(scope("projects.create"), actor, {
    ...projectInput,
    serviceTypes: ["cctv", "network"],
    customerId: customer.id,
    leadId: "9007199254740993"
  });
  assert.equal(project.leadId, "9007199254740993");
  assert.deepEqual(project.serviceTypes, ["cctv", "network"]);
  assert.deepEqual(
    (await owner.query("SELECT service_types FROM sarathi.projects WHERE id=$1", [project.id]))
      .rows[0].service_types,
    ["cctv", "network"]
  );
  const converted = (
    await owner.query("SELECT status, customer_id::text FROM sarathi.leads WHERE id=$1", [
      project.leadId
    ])
  ).rows[0];
  assert.deepEqual(converted, { status: "CONVERTED", customer_id: customer.id });
  const history = (
    await owner.query(
      "SELECT to_status, changed_by::text FROM sarathi.status_history WHERE project_id=$1",
      [project.id]
    )
  ).rows;
  assert.deepEqual(history, [{ to_status: "SURVEY_PENDING", changed_by: actor }]);
  await assert.rejects(
    business.createProject(scope("projects.create"), actor, {
      ...projectInput,
      customerId: customer.id,
      leadId: project.leadId!
    }),
    /already been converted/
  );
  await assert.rejects(
    business.updateLeadStatus(scope("leads.update"), project.leadId!, "NEW", "CONVERTED"),
    InputError
  );
});

test("unknown project service IDs cannot insert a project or convert its lead", async () => {
  const customer = await business.createCustomer(scope("customers.create"), customerInput);
  const lead = await business.createLead(scope("leads.create"), leadInput);
  await assert.rejects(
    business.createProject(scope("projects.create"), actor, {
      ...projectInput,
      customerId: customer.id,
      leadId: lead.id,
      serviceTypes: ["network", "unknown-service"]
    }),
    InputError
  );
  assert.equal(
    (await owner.query("SELECT id FROM sarathi.projects WHERE lead_id=$1", [lead.id])).rowCount,
    0
  );
  assert.equal(
    (await owner.query("SELECT status FROM sarathi.leads WHERE id=$1", [lead.id])).rows[0].status,
    "NEW"
  );
});

test("conversion rolls back project and lead when history fails", async () => {
  const customer = await business.createCustomer(scope("customers.create"), customerInput);
  const lead = await business.createLead(scope("leads.create"), leadInput);
  // Inject a final audit failure after the project/lead changes.
  await rejectHistoryDuring(async () => {
    await assert.rejects(
      business.createProject(scope("projects.create"), actor, {
        ...projectInput,
        customerId: customer.id,
        leadId: lead.id
      }),
      (error: unknown) => (error as { code?: string }).code === "23514"
    );
  });
  assert.equal(
    (await owner.query("SELECT 1 FROM sarathi.projects WHERE lead_id=$1", [lead.id])).rowCount,
    0
  );
  assert.equal(
    (await owner.query("SELECT status FROM sarathi.leads WHERE id=$1", [lead.id])).rows[0].status,
    "NEW"
  );
});

test("concurrent conversion makes exactly one project; mismatched customer is rejected", async () => {
  const customer = await business.createCustomer(scope("customers.create"), customerInput);
  const lead = await business.createLead(scope("leads.create"), leadInput);
  const input = { ...projectInput, customerId: customer.id, leadId: lead.id };
  const outcomes = await Promise.allSettled([
    business.createProject(scope("projects.create"), actor, input),
    business.createProject(scope("projects.create"), actor, input)
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(
    (await owner.query("SELECT 1 FROM sarathi.projects WHERE lead_id=$1", [lead.id])).rowCount,
    1
  );
  const linked = await business.createLead(scope("leads.create"), leadInput);
  const other = await business.createCustomer(scope("customers.create"), customerInput);
  await owner.query("UPDATE sarathi.leads SET customer_id=$1 WHERE id=$2", [other.id, linked.id]);
  await assert.rejects(
    business.createProject(scope("projects.create"), actor, { ...input, leadId: linked.id }),
    /another customer/
  );
});

test("audited stages require exception reasons and reject stale, held and missing records", async () => {
  const customer = await business.createCustomer(scope("customers.create"), customerInput);
  const project = await business.createProject(scope("projects.create"), actor, {
    ...projectInput,
    customerId: customer.id
  });
  await assert.rejects(
    business.updateProjectStatus(
      scope("projects.update"),
      actor,
      project.id,
      "COSTING",
      "SURVEY_PENDING"
    ),
    /reason/
  );
  const changes = await Promise.allSettled([
    business.updateProjectStatus(
      scope("projects.update"),
      actor,
      project.id,
      "SURVEY_COMPLETE",
      "SURVEY_PENDING"
    ),
    business.updateProjectStatus(
      scope("projects.update"),
      actor,
      project.id,
      "COSTING",
      "SURVEY_PENDING",
      "Survey already recorded"
    )
  ]);
  assert.equal(changes.filter((result) => result.status === "fulfilled").length, 1);
  const current = (
    await owner.query("SELECT operational_status FROM sarathi.projects WHERE id=$1", [project.id])
  ).rows[0].operational_status;
  await business.updateProjectStatus(
    scope("projects.update"),
    actor,
    project.id,
    "COMPLETED",
    current,
    "Existing installation handed over"
  );
  await business.updateProjectStatus(
    scope("projects.update"),
    actor,
    project.id,
    "TESTING",
    "COMPLETED",
    "Customer requested another test"
  );
  const histories = (
    await owner.query(
      "SELECT to_status, reason FROM sarathi.status_history WHERE project_id=$1 ORDER BY id",
      [project.id]
    )
  ).rows;
  assert.equal(histories.length, 4);
  assert.equal(histories.at(-1)?.reason, "Customer requested another test");
  await business.updateProjectStatus(
    scope("projects.update"),
    actor,
    project.id,
    "TESTING",
    "TESTING"
  );
  assert.equal(
    (await owner.query("SELECT 1 FROM sarathi.status_history WHERE project_id=$1", [project.id]))
      .rowCount,
    4
  );
  await owner.query(
    "UPDATE sarathi.projects SET on_hold=true, hold_reason='Awaiting customer' WHERE id=$1",
    [project.id]
  );
  await assert.rejects(
    business.updateProjectStatus(
      scope("projects.update"),
      actor,
      project.id,
      "COMPLETED",
      "TESTING"
    ),
    /hold/
  );
  await assert.rejects(
    business.updateProjectStatus(
      scope("projects.update"),
      actor,
      "9223372036854775807",
      "COSTING",
      "SURVEY_PENDING",
      "Reason"
    ),
    /no longer exists/
  );
});

test("failed audit rolls back stage, and lead status cannot fake conversion or stale success", async () => {
  const customer = await business.createCustomer(scope("customers.create"), customerInput);
  const project = await business.createProject(scope("projects.create"), actor, {
    ...projectInput,
    customerId: customer.id
  });
  await rejectHistoryDuring(async () => {
    await assert.rejects(
      business.updateProjectStatus(
        scope("projects.update"),
        actor,
        project.id,
        "SURVEY_COMPLETE",
        "SURVEY_PENDING"
      )
    );
  });
  assert.equal(
    (await owner.query("SELECT operational_status FROM sarathi.projects WHERE id=$1", [project.id]))
      .rows[0].operational_status,
    "SURVEY_PENDING"
  );
  const lead = await business.createLead(scope("leads.create"), leadInput);
  await assert.rejects(
    business.updateLeadStatus(scope("leads.update"), lead.id, "CONVERTED", "NEW"),
    /creating a project/
  );
  await business.updateLeadStatus(scope("leads.update"), lead.id, "CONTACTED", "NEW");
  await assert.rejects(
    business.updateLeadStatus(scope("leads.update"), lead.id, "LOST", "NEW"),
    /changed since/
  );
  await assert.rejects(
    business.updateLeadStatus(scope("leads.update"), "9223372036854775807", "LOST", "NEW"),
    /no longer exists/
  );
});

test("new write permissions do not grant deletion, role changes, money writes or costs", async () => {
  assert.equal((await runtime.query("UPDATE sarathi.customers SET name='changed'")).rowCount, 0);
  for (const sql of [
    "DELETE FROM sarathi.customers",
    "UPDATE sarathi.users SET active=false",
    "UPDATE sarathi.customers SET organization_id=2",
    "UPDATE sarathi.customers SET version=2",
    "DELETE FROM sarathi.customer_changes",
    "SELECT * FROM sarathi.bom_items",
    "DELETE FROM sarathi.status_history",
    "UPDATE sarathi.payments SET amount=1",
    "CREATE TABLE sarathi.not_allowed(id int)"
  ])
    await assert.rejects(
      runtime.query(sql),
      (error: unknown) => (error as { code?: string }).code === "42501"
    );
});

test("lists paginate numerically without duplicates and apply search/status on the server", async () => {
  await owner.query(`INSERT INTO sarathi.leads(contact_name,phone,service_requested,status)
    SELECT 'Paging % fixture ' || n, '9999999999', 'CCTV', CASE WHEN n%2=0 THEN 'CONTACTED' ELSE 'NEW' END
    FROM generate_series(1,61) n`);
  const first = await getListPage(scope("dashboard.read"), "leads", { q: "Paging % fixture" });
  assert.equal(first.items.length, 50);
  assert.equal(first.total, 61);
  assert.ok(first.next);
  for (let i = 1; i < first.items.length; i++)
    assert.ok(BigInt(first.items[i - 1].id) > BigInt(first.items[i].id));
  const second = await getListPage(scope("dashboard.read"), "leads", {
    q: "Paging % fixture",
    after: first.next!
  });
  assert.equal(second.items.length, 11);
  assert.equal(second.total, 61);
  assert.equal(second.next, null);
  assert.equal(new Set([...first.items, ...second.items].map((row) => row.id)).size, 61);
  const filtered = await getListPage(scope("dashboard.read"), "leads", {
    q: "Paging % fixture",
    status: "CONTACTED"
  });
  assert.equal(filtered.total, 30);
  assert.ok(filtered.items.every((row) => row.status === "CONTACTED"));
  assert.equal(
    (await getListPage(scope("dashboard.read"), "leads", { q: "' OR 1=1 --" })).total,
    0
  );
  for (const kind of ["customers", "projects", "quotes", "payments"] as const) {
    const page = await getListPage(scope("dashboard.read"), kind, {});
    assert.ok(page.items.length <= 50);
  }
  const options = await customerOptions(scope("customers.read"), "Integration");
  assert.ok(options.length <= 25);
  for (const option of options)
    assert.deepEqual(Object.keys(option).sort(), ["id", "name", "phone"]);
  const counts = await projectCounts(scope("projects.read"));
  assert.equal(
    counts.ALL,
    Number((await owner.query("SELECT count(*) FROM sarathi.projects")).rows[0].count)
  );
  assert.match(first.items[0].createdAt, /Z$/);
});
