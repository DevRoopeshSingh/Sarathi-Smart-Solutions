import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import { tenantPool } from "../src/server/tenant-pool";
import * as business from "../src/server/business";
import * as dal from "../src/server/dal";
import { getWorkflowDetail } from "../src/server/workflow";
import { AccessDeniedError } from "../src/server/mutation-errors";
import { getPool } from "../src/server/db";

if (process.env.OPERATIONS_TEST_ISOLATED !== "1") throw new Error("Use the isolated harness.");
const owner = new pg.Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, max: 1 });
const runtime = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const origin = process.env.OPERATIONS_TEST_URL!;
const password = process.env.OPERATIONS_TEST_PASSWORD!;
after(async () => {
  await owner.end();
  await runtime.end();
  await getPool().end();
});
const orgA = (await owner.query("SELECT id::text FROM sarathi.organizations WHERE slug='sarathi'"))
  .rows[0].id;
const smartA = (
  await owner.query(
    "SELECT id::text FROM sarathi.divisions WHERE organization_id=$1 AND slug='smart-solutions'",
    [orgA]
  )
).rows[0].id;
const digitalA = (
  await owner.query(
    "SELECT id::text FROM sarathi.divisions WHERE organization_id=$1 AND slug='digital-seva-kendra'",
    [orgA]
  )
).rows[0].id;
const orgB = (
  await owner.query(
    "INSERT INTO sarathi.organizations(slug,name) VALUES('isolation-b','Isolation B') RETURNING id::text"
  )
).rows[0].id;
const smartB = (
  await owner.query(
    "INSERT INTO sarathi.divisions(organization_id,slug,name) VALUES($1,'smart-solutions','Smart B') RETURNING id::text",
    [orgB]
  )
).rows[0].id;
async function actor(email: string) {
  return (
    await owner.query(
      "SELECT u.id::text FROM sarathi.users u JOIN sarathi.auth_users a ON a.id=u.identity_subject WHERE a.email=$1",
      [email]
    )
  ).rows[0].id as string;
}
const adminA = await actor("admin@example.test");
const operatorA = await actor("operator@example.test");
const viewerA = await actor("viewer@example.test");
const hash = await hashPassword(password);
async function identity(email: string, role: string, org: string, division: string) {
  const id = randomUUID();
  await owner.query(
    "INSERT INTO sarathi.auth_users(id,name,email,email_verified) VALUES($1,$2,$2,true)",
    [id, email]
  );
  await owner.query(
    "INSERT INTO sarathi.auth_accounts(id,user_id,account_id,provider_id,password) VALUES($1,$2,$2,'credential',$3)",
    [randomUUID(), id, hash]
  );
  const user = (
    await owner.query(
      "INSERT INTO sarathi.users(identity_subject,display_name,role,onboarding_completed_at) VALUES($1,$2,$3,now()) RETURNING id::text",
      [id, email, role]
    )
  ).rows[0].id;
  const member = (
    await owner.query(
      "INSERT INTO sarathi.organization_memberships(organization_id,user_id,role) VALUES($1,$2,$3) RETURNING id",
      [org, user, role]
    )
  ).rows[0].id;
  await owner.query(
    "INSERT INTO sarathi.division_assignments(organization_id,membership_id,division_id) VALUES($1,$2,$3)",
    [org, member, division]
  );
  return user as string;
}
const adminB = await identity("b-admin@example.test", "ADMIN", orgB, smartB);
const operatorB = await identity("b-operator@example.test", "OPERATOR", orgB, smartB);
const viewerB = await identity("b-viewer@example.test", "VIEWER", orgB, smartB);
const scope = (who: string, org: string, p: Parameters<typeof tenantPool>[3]) =>
  tenantPool(runtime, who, org, p);
async function records(org: string, division: string, who: string, label: string) {
  const customer = (
    await owner.query(
      "INSERT INTO sarathi.customers(organization_id,name,phone) VALUES($1,$2,'9999999999') RETURNING id::text",
      [org, "Overlapping customer " + label]
    )
  ).rows[0].id;
  const lead = (
    await owner.query(
      "INSERT INTO sarathi.leads(organization_id,division_id,contact_name,phone,service_requested) VALUES($1,$2,$3,'9999999999','CCTV') RETURNING id::text",
      [org, division, "Overlapping lead " + label]
    )
  ).rows[0].id;
  const project = (
    await owner.query(
      "INSERT INTO sarathi.projects(organization_id,division_id,customer_id,name,site_address,service_types) VALUES($1,$2,$3,$4,'Mumbai',ARRAY['cctv','network']) RETURNING id::text",
      [org, division, customer, "Overlapping project " + label]
    )
  ).rows[0].id;
  const quote = (
    await owner.query(
      `INSERT INTO sarathi.quotations(organization_id,project_id,customer_id,created_by,version,customer_name,customer_phone,site_address,subtotal,total,recommended_advance,terms,valid_until)
 VALUES($1,$2,$3,$4,1,$5,'9999999999','Mumbai',100,100,50,$5,current_date+30) RETURNING id::text`,
      [org, project, customer, who, "PRIVATE " + label]
    )
  ).rows[0].id;
  await owner.query(
    "INSERT INTO sarathi.payments(organization_id,project_id,quotation_id,kind,amount,idempotency_key,payment_method,occurred_at,recorded_by,note) VALUES($1,$2,$3,'RECEIPT',50,'same-key-'||$4,'CASH',now(),$5,$4)",
    [org, project, quote, division, who]
  );
  await owner.query(
    "INSERT INTO sarathi.status_history(organization_id,project_id,from_status,to_status,was_on_hold,is_on_hold,reason,changed_by) VALUES($1,$2,'SURVEY_PENDING','SURVEY_COMPLETE',false,false,$3,$4)",
    [org, project, "PRIVATE history " + label, who]
  );
  return { customer, lead, project, quote };
}
const a = await records(orgA, smartA, adminA, "A");
const b = await records(orgB, smartB, adminB, "B");
const hidden = await records(orgA, digitalA, adminA, "DIGITAL");
async function login(email: string) {
  await owner.query("DELETE FROM sarathi.auth_ratelimits");
  const response = await fetch(origin + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  assert.equal(response.status, 200);
  return new Headers({
    Cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
  });
}
const headersA = await login("admin@example.test");
const headersB = await login("b-admin@example.test");
const headersOperator = await login("operator@example.test");
const headersViewer = await login("viewer@example.test");
const denied = (e: unknown) => e instanceof AccessDeniedError;
const constraint = (e: unknown) => (e as { code?: string }).code === "23503";

test("customers, search, options and counts are isolated bidirectionally", async () => {
  for (const [headers, own, foreign] of [
    [headersA, a, b],
    [headersB, b, a]
  ] as const) {
    const list = await dal.getCustomers(headers, { q: "Overlapping" });
    assert.ok(list.items.some((c) => c.id === own.customer));
    assert.ok(!list.items.some((c) => c.id === foreign.customer));
    assert.ok(
      !(await dal.getCustomerOptions(headers, "Overlapping")).some((c) => c.id === foreign.customer)
    );
    for (const [reader, id] of [
      [dal.getLeads, foreign.lead],
      [dal.getProjects, foreign.project],
      [dal.getQuotations, foreign.quote]
    ] as const)
      assert.ok(!(await reader(headers, { q: "Overlapping" })).items.some((c) => c.id === id));
    const payments = await dal.getPayments(headers, { q: "Overlapping" });
    assert.ok(payments.items.some((p) => p.projectId === own.project));
    assert.ok(!payments.items.some((p) => p.projectId === foreign.project));
    const overview = await dal.getAdminOverview(headers);
    const org = headers === headersA ? orgA : orgB;
    for (const table of ["leads", "projects", "quotations"] as const)
      assert.equal(
        overview.counts[table],
        Number(
          (
            await owner.query(`SELECT count(*) FROM sarathi.${table} WHERE organization_id=$1`, [
              org
            ])
          ).rows[0].count
        )
      );
  }
});

test("foreign detail IDs and project history cannot escape their organization", async () => {
  for (const [headers, foreign] of [
    [headersA, b],
    [headersB, a]
  ] as const)
    for (const [kind, id] of [
      ["lead", foreign.lead],
      ["project", foreign.project],
      ["quote", foreign.quote]
    ] as const) {
      assert.equal(await getWorkflowDetail(headers, kind, id), null);
      assert.equal(
        (
          await fetch(origin + `/admin/${kind === "quote" ? "quotes" : kind + "s"}/${id}`, {
            headers,
            redirect: "manual"
          })
        ).status,
        404
      );
    }
  const detail = await getWorkflowDetail(headersA, "project", a.project);
  assert.ok(detail?.events.some((e) => e.description === "PRIVATE history A"));
  assert.ok(!JSON.stringify(detail).includes("PRIVATE history B"));
});

test("HTTP search and selector endpoints ignore forged tenant/actor headers", async () => {
  const headers = new Headers(headersA);
  headers.set("x-organization-id", orgB);
  headers.set("x-actor-id", adminB);
  const options = await fetch(origin + "/api/admin/customer-options?q=Overlapping", { headers });
  const body = await options.text();
  assert.equal(options.status, 200);
  assert.ok(!body.includes("Overlapping customer B"));
  for (const route of [
    "/admin",
    "/admin/leads?q=Overlapping",
    "/admin/projects?q=Overlapping",
    "/admin/quotes?q=PRIVATE",
    "/admin/payments?q=PRIVATE",
    "/admin/users"
  ]) {
    const response = await fetch(origin + route, { headers });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(!html.includes("Overlapping project B"));
    assert.ok(!html.includes("b-admin@example.test"));
    assert.ok(!html.includes("PRIVATE history B"));
  }
});

test("foreign updates, linked customer/lead IDs and forged audit actors fail without partial writes", async () => {
  await assert.rejects(dal.updateLeadStatus(headersA, b.lead, "CONTACTED", "NEW"));
  await assert.rejects(
    dal.updateProjectStatus(headersA, b.project, "SURVEY_COMPLETE", "SURVEY_PENDING")
  );
  const before = (
    await owner.query("SELECT count(*) FROM sarathi.projects WHERE organization_id=$1", [orgA])
  ).rows[0].count;
  for (const data of [{ customerId: b.customer }, { customerId: a.customer, leadId: b.lead }])
    await assert.rejects(
      dal.createProject(headersA, {
        ...data,
        name: "Cross tenant attack",
        siteAddress: "Mumbai",
        serviceTypes: ["cctv"]
      })
    );
  await assert.rejects(
    business.updateProjectStatus(
      scope(adminA, orgA, "projects.update"),
      adminB,
      a.project,
      "SURVEY_COMPLETE",
      "SURVEY_PENDING"
    ),
    /Invalid audit actor/
  );
  assert.equal(
    (await owner.query("SELECT count(*) FROM sarathi.projects WHERE organization_id=$1", [orgA]))
      .rows[0].count,
    before
  );
  assert.equal(
    (await owner.query("SELECT status FROM sarathi.leads WHERE id=$1", [b.lead])).rows[0].status,
    "NEW"
  );
  assert.equal(
    (await owner.query("SELECT operational_status FROM sarathi.projects WHERE id=$1", [b.project]))
      .rows[0].operational_status,
    "SURVEY_PENDING"
  );
});

test("composite ownership constraints reject foreign references independently of application guards", async () => {
  const cases: Array<[string, unknown[]]> = [
    [
      "INSERT INTO sarathi.leads(organization_id,division_id,customer_id,contact_name,phone,service_requested) VALUES($1,$2,$3,'attack','9','CCTV')",
      [orgA, smartA, b.customer]
    ],
    [
      "INSERT INTO sarathi.projects(organization_id,division_id,customer_id,name,site_address) VALUES($1,$2,$3,'attack','Mumbai')",
      [orgA, smartA, b.customer]
    ],
    [
      "INSERT INTO sarathi.projects(organization_id,division_id,customer_id,lead_id,name,site_address) VALUES($1,$2,$3,$4,'attack','Mumbai')",
      [orgA, smartA, a.customer, b.lead]
    ],
    [
      "INSERT INTO sarathi.project_costings(organization_id,project_id) VALUES($1,$2)",
      [orgA, b.project]
    ],
    [
      "INSERT INTO sarathi.status_history(organization_id,project_id,to_status,was_on_hold,is_on_hold,changed_by) VALUES($1,$2,'SURVEY_PENDING',false,false,$3)",
      [orgA, b.project, adminA]
    ],
    [
      "INSERT INTO sarathi.status_history(organization_id,project_id,to_status,was_on_hold,is_on_hold,changed_by) VALUES($1,$2,'SURVEY_PENDING',false,false,$3)",
      [orgA, a.project, adminB]
    ],
    [
      "INSERT INTO sarathi.quotation_items(organization_id,quotation_id,position,description,unit,quantity,unit_sell) VALUES($1,$2,1,'attack','each',1,1)",
      [orgA, b.quote]
    ],
    [
      "INSERT INTO sarathi.payments(organization_id,project_id,quotation_id,kind,amount,idempotency_key,payment_method,occurred_at,recorded_by) VALUES($1,$2,$3,'RECEIPT',1,'attack','CASH',now(),$4)",
      [orgA, a.project, b.quote, adminA]
    ]
  ];
  for (const [sql, params] of cases) await assert.rejects(owner.query(sql, params), constraint);
});

test("organization-scoped SKU and payment idempotency keys support overlapping tenants", async () => {
  for (const org of [orgA, orgB])
    await owner.query(
      "INSERT INTO sarathi.products(organization_id,sku,name,unit) VALUES($1,'SAME-SKU','Camera','each')",
      [org]
    );
  await assert.rejects(
    owner.query(
      "INSERT INTO sarathi.products(organization_id,sku,name,unit) VALUES($1,'SAME-SKU','Camera','each')",
      [orgA]
    ),
    (e: unknown) => (e as { code?: string }).code === "23505"
  );
  for (const [org, project, who] of [
    [orgA, a.project, adminA],
    [orgB, b.project, adminB]
  ])
    await owner.query(
      "INSERT INTO sarathi.payments(organization_id,project_id,kind,amount,idempotency_key,payment_method,occurred_at,recorded_by) VALUES($1,$2,'RECEIPT',1,'SHARED-KEY','CASH',now(),$3)",
      [org, project, who]
    );
});

test("division assignments constrain list, detail, history, counts and mutations within one organization", async () => {
  assert.ok(!(await dal.getLeads(headersOperator)).items.some((l) => l.id === hidden.lead));
  assert.ok(!(await dal.getProjects(headersOperator)).items.some((p) => p.id === hidden.project));
  assert.ok(!(await dal.getQuotations(headersOperator)).items.some((q) => q.id === hidden.quote));
  assert.equal(await getWorkflowDetail(headersOperator, "project", hidden.project), null);
  await assert.rejects(dal.updateLeadStatus(headersOperator, hidden.lead, "CONTACTED", "NEW"));
  await assert.rejects(
    dal.updateProjectStatus(headersOperator, hidden.project, "SURVEY_COMPLETE", "SURVEY_PENDING")
  );
  const counts = await dal.getProjectCounts(headersOperator);
  assert.equal(
    counts.ALL,
    Number(
      (
        await owner.query(
          "SELECT count(*) FROM sarathi.projects WHERE organization_id=$1 AND division_id=$2",
          [orgA, smartA]
        )
      ).rows[0].count
    )
  );
  const customers = await dal.getCustomers(headersOperator, { q: "Overlapping customer DIGITAL" });
  assert.equal(customers.items[0].projectCount, 0); // Customers are org-wide, project aggregates are division-scoped.
});

test("conversion preserves the original assigned division and project services", async () => {
  await owner.query(
    "INSERT INTO sarathi.division_assignments(organization_id,membership_id,division_id) SELECT $1,m.id,$2 FROM sarathi.organization_memberships m WHERE m.organization_id=$1 AND m.user_id=$3",
    [orgA, digitalA, operatorA]
  );
  try {
    const project = await dal.createProject(headersOperator, {
      customerId: hidden.customer,
      leadId: hidden.lead,
      name: "Digital conversion",
      siteAddress: "Mumbai",
      serviceTypes: ["cctv", "network"]
    });
    const saved = (
      await owner.query(
        "SELECT division_id::text,service_types FROM sarathi.projects WHERE id=$1",
        [project.id]
      )
    ).rows[0];
    assert.equal(saved.division_id, digitalA);
    assert.deepEqual(saved.service_types, ["cctv", "network"]);
  } finally {
    await owner.query(
      "DELETE FROM sarathi.division_assignments WHERE organization_id=$1 AND division_id=$2 AND membership_id IN(SELECT id FROM sarathi.organization_memberships WHERE user_id=$3)",
      [orgA, digitalA, operatorA]
    );
  }
});

test("viewer write and financial access restrictions apply to direct persistence and DAL calls", async () => {
  await assert.rejects(
    dal.createCustomer(headersViewer, { name: "Attack", phone: "9999999999" }),
    denied
  );
  await assert.rejects(
    dal.updateProjectStatus(headersViewer, a.project, "SURVEY_COMPLETE", "SURVEY_PENDING"),
    denied
  );
  await assert.rejects(dal.getPayments(headersViewer), denied);
  await assert.rejects(dal.requirePermission(headersOperator, "payments.create"), denied);
  await assert.rejects(
    business.createLead(scope(viewerA, orgA, "leads.create"), {
      contactName: "Attack",
      phone: "9999999999",
      serviceRequested: "CCTV"
    }),
    denied
  );
  await assert.rejects(
    business.createLead(scope(viewerA, orgA, "leads.read"), {
      contactName: "Attack",
      phone: "9999999999",
      serviceRequested: "CCTV"
    }),
    (e: unknown) => (e as { code?: string }).code === "42501"
  );
  assert.equal(
    (await scope(viewerA, orgA, "dashboard.read").query("SELECT * FROM sarathi.payments")).rowCount,
    0
  );
  await assert.rejects(scope(operatorA, orgA, "payments.create").query("SELECT 1"), denied);
  await assert.rejects(dal.getManagedUsers(headersOperator), denied);
  await assert.rejects(dal.setManagedUserRole(headersOperator, operatorA, "ADMIN"), denied);
  await assert.rejects(dal.setManagedUserRole(headersViewer, viewerA, "ADMIN"), denied);
});

test("staff listing and role changes cannot reach other organizations or alter shared memberships", async () => {
  assert.ok(!(await dal.getManagedUsers(headersA)).some((u) => u.id === adminB));
  assert.ok(!(await dal.getManagedUsers(headersB)).some((u) => u.id === adminA));
  await assert.rejects(dal.setManagedUserRole(headersA, operatorB, "ADMIN"));
  await owner.query(
    "INSERT INTO sarathi.organization_memberships(organization_id,user_id,role) VALUES($1,$2,'VIEWER')",
    [orgB, operatorA]
  );
  try {
    await dal.setManagedUserRole(headersA, operatorA, "VIEWER");
    assert.equal(
      (
        await owner.query(
          "SELECT role FROM sarathi.organization_memberships WHERE organization_id=$1 AND user_id=$2",
          [orgB, operatorA]
        )
      ).rows[0].role,
      "VIEWER"
    );
    assert.equal(
      (await owner.query("SELECT role FROM sarathi.users WHERE id=$1", [operatorA])).rows[0].role,
      "OPERATOR"
    );
    await assert.rejects(
      dal.createCustomer(headersOperator, { name: "Denied", phone: "9999999999" }),
      denied
    );
    await dal.setManagedUserRole(headersA, operatorA, "OPERATOR");
    await assert.rejects(dal.setManagedUserRole(headersA, operatorA, "ADMIN"));
    await owner.query(
      "UPDATE sarathi.organization_memberships SET active=false WHERE organization_id=$1 AND user_id=$2",
      [orgB, operatorA]
    );
    await assert.rejects(dal.setManagedUserRole(headersA, operatorA, "ADMIN"));
    assert.equal(
      (await owner.query("SELECT role FROM sarathi.users WHERE id=$1", [operatorA])).rows[0].role,
      "OPERATOR"
    );
  } finally {
    await owner.query(
      "UPDATE sarathi.organization_memberships SET role='OPERATOR' WHERE organization_id=$1 AND user_id=$2",
      [orgA, operatorA]
    );
    await owner.query(
      "DELETE FROM sarathi.organization_memberships WHERE organization_id=$1 AND user_id=$2",
      [orgB, operatorA]
    );
  }
  await assert.rejects(dal.setManagedUserRole(headersA, adminA, "VIEWER"));
  await assert.rejects(
    scope(adminA, orgA, "admin.users.manage").query(
      "SELECT sarathi.admin_set_membership_role($1,$2,$3,'ADMIN')",
      [adminB, orgB, operatorB]
    ),
    (e: unknown) => (e as { code?: string }).code === "42501"
  );
  await assert.rejects(
    runtime.query("SELECT sarathi.admin_set_user_role($1,$2,'ADMIN')", [adminA, operatorB]),
    (e: unknown) => (e as { code?: string }).code === "42501"
  );
});

test("revoked memberships and assignments invalidate previously created scopes and existing HTTP sessions", async () => {
  const stale = scope(operatorA, orgA, "projects.update");
  await stale.query("SELECT 1");
  await owner.query(
    "UPDATE sarathi.organization_memberships SET active=false WHERE organization_id=$1 AND user_id=$2",
    [orgA, operatorA]
  );
  try {
    await assert.rejects(stale.query("SELECT * FROM sarathi.projects"), denied);
    await assert.rejects(dal.getCustomers(headersOperator), denied);
    assert.equal(
      (await fetch(origin + "/api/admin/customer-options", { headers: headersOperator })).status,
      401
    );
    assert.equal((await fetch(origin + "/api/admin/me", { headers: headersOperator })).status, 401);
  } finally {
    await owner.query(
      "UPDATE sarathi.organization_memberships SET active=true WHERE organization_id=$1 AND user_id=$2",
      [orgA, operatorA]
    );
  }
  const client = await stale.connect();
  try {
    await client.query("BEGIN");
    await owner.query(
      "UPDATE sarathi.division_assignments SET active=false WHERE organization_id=$1 AND division_id=$2 AND membership_id IN(SELECT id FROM sarathi.organization_memberships WHERE user_id=$3)",
      [orgA, smartA, operatorA]
    );
    assert.equal(
      (await client.query("SELECT * FROM sarathi.projects WHERE id=$1", [a.project])).rowCount,
      0
    );
    assert.equal(
      (
        await client.query(
          "UPDATE sarathi.projects SET operational_status='SURVEY_COMPLETE' WHERE id=$1",
          [a.project]
        )
      ).rowCount,
      0
    );
    await client.query("ROLLBACK");
  } finally {
    client.release();
    await owner.query(
      "UPDATE sarathi.division_assignments SET active=true WHERE organization_id=$1 AND division_id=$2 AND membership_id IN(SELECT id FROM sarathi.organization_memberships WHERE user_id=$3)",
      [orgA, smartA, operatorA]
    );
  }
});

test("pool reuse/concurrency never carries tenant context and raw runtime access fails closed", async () => {
  const scopes = [scope(adminA, orgA, "customers.read"), scope(adminB, orgB, "customers.read")];
  await Promise.all(
    Array.from({ length: 10 }, async (_, i) => {
      const rows = (
        await scopes[i % 2].query("SELECT organization_id::text FROM sarathi.customers")
      ).rows;
      assert.ok(rows.length);
      assert.ok(rows.every((r) => r.organization_id === (i % 2 ? orgB : orgA)));
    })
  );
  await assert.rejects(
    scope(adminA, orgB, "customers.read").query("SELECT * FROM sarathi.customers"),
    denied
  );
  await assert.rejects(
    tenantPool(owner, adminA, orgA, "customers.read").query("SELECT * FROM sarathi.customers"),
    /restricted runtime role/
  );
  assert.equal((await runtime.query("SELECT * FROM sarathi.customers")).rowCount, 0);
  assert.equal(
    (
      await runtime.query(
        "SELECT nullif(current_setting('sarathi.organization_id',true),'') AS scope"
      )
    ).rows[0].scope,
    null
  );
  await assert.rejects(
    runtime.query("INSERT INTO sarathi.customers(name,phone) VALUES('Unscoped','9')")
  );
  for (const table of ["leads", "projects", "customers"])
    await assert.rejects(
      runtime.query(`DELETE FROM sarathi.${table}`),
      (e: unknown) => (e as { code?: string }).code === "42501"
    );
});

const manifest = JSON.parse(
  await readFile(new URL("../.next/server/server-reference-manifest.json", import.meta.url), "utf8")
);
async function action(name: string, args: unknown[], headers: Headers, path = "/admin/projects") {
  const entry = Object.entries(manifest.node).find(
    ([, v]) => (v as { exportedName: string }).exportedName === name
  );
  assert.ok(entry, "Built server action exists");
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "text/x-component");
  requestHeaders.set("Origin", origin);
  requestHeaders.set("Next-Action", entry[0]);
  requestHeaders.set("Content-Type", "text/plain;charset=UTF-8");
  return fetch(origin + path, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(args),
    redirect: "manual"
  });
}
test("direct HTTP server actions reject foreign identifiers and viewer/admin privilege escalation", async () => {
  for (const [name, args, headers, path] of [
    ["updateLeadStatusAction", [b.lead, "CONTACTED", "NEW"], headersA, "/admin/leads"],
    [
      "updateProjectStatusAction",
      [b.project, "SURVEY_COMPLETE", "SURVEY_PENDING"],
      headersA,
      "/admin/projects"
    ],
    [
      "updateProjectStatusAction",
      [a.project, "SURVEY_COMPLETE", "SURVEY_PENDING"],
      headersViewer,
      "/admin/projects"
    ],
    ["setManagedUserRoleAction", [operatorB, "ADMIN"], headersA, "/admin/users"],
    ["setManagedUserRoleAction", [operatorA, "ADMIN"], headersOperator, "/admin/users"]
  ] as Array<[string, unknown[], Headers, string]>) {
    const response = await action(name, args, headers, path);
    const text = await response.text();
    assert.equal(response.status, 200);
    const returned = text
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line.slice(line.indexOf(":") + 1));
        } catch {
          return null;
        }
      })
      .find((value) => value && typeof value.error === "string");
    assert.ok(returned, name + " must return an action error");
    assert.ok(!text.includes('"success":true'));
    assert.ok(!text.includes("PRIVATE"));
  }
  assert.equal(
    (await owner.query("SELECT status FROM sarathi.leads WHERE id=$1", [b.lead])).rows[0].status,
    "NEW"
  );
  assert.equal(
    (
      await owner.query(
        "SELECT role FROM sarathi.organization_memberships WHERE organization_id=$1 AND user_id=$2",
        [orgB, operatorB]
      )
    ).rows[0].role,
    "OPERATOR"
  );
});

test("owner provisioning/recovery require an active selected organization and preserve transaction rollback", async () => {
  const email = "wrong-org-recovery@example.test";
  const created = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "scripts/provision-admin.ts"],
    {
      env: {
        ...process.env,
        SARATHI_ORGANIZATION_SLUG: "missing-organization",
        SARATHI_ADMIN_EMAIL: email,
        SARATHI_ADMIN_NAME: "Rollback",
        SARATHI_USER_ROLE: "ADMIN"
      },
      input: password + "\n",
      encoding: "utf8",
      timeout: 15000
    }
  );
  assert.equal(created.status, 1);
  assert.equal(
    (await owner.query("SELECT 1 FROM sarathi.auth_users WHERE email=$1", [email])).rowCount,
    0
  );
  const recovery = spawnSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "scripts/recover-admin.ts"],
    {
      env: {
        ...process.env,
        SARATHI_ORGANIZATION_SLUG: "sarathi",
        SARATHI_ADMIN_EMAIL: "b-admin@example.test"
      },
      input: password + "\n",
      encoding: "utf8",
      timeout: 15000
    }
  );
  assert.equal(recovery.status, 1);
  // The three current roles are exhaustive. Manager-like work uses OPERATOR; no invented role.
  assert.ok(
    (await scope(viewerB, orgB, "projects.read").query("SELECT id FROM sarathi.projects"))
      .rowCount! > 0
  );
});
