import "server-only";
import type { Pool, PoolClient } from "pg";
import { requiresProjectTransitionReason } from "../lib/operations";
import type {
  CustomerRecord,
  LeadRecord,
  LeadStatus,
  ProjectRecord,
  ProjectStatus
} from "../lib/operations";
import {
  boundedText,
  databaseId,
  leadStatus,
  projectStatus,
  validateCustomer,
  validateLead,
  validateProject
} from "./input";
import type { CreateCustomerInput, CreateLeadInput, CreateProjectInput } from "./input";
import { InputError } from "./mutation-errors";

// Internal persistence operations. The DAL must authorize before calling these;
// actorId always comes from requireAdmin, never from submitted form data.
async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}

function expectOne(rowCount: number | null, message: string) {
  if (rowCount !== 1) throw new InputError(message);
}

export async function createLead(pool: Pool, input: CreateLeadInput): Promise<LeadRecord> {
  const data = validateLead(input);
  const result = await pool.query<LeadRecord>(
    `
    INSERT INTO sarathi.leads (contact_name, phone, service_requested, source, notes, status)
    VALUES ($1, $2, $3, $4, $5, 'NEW')
    RETURNING id::text, customer_id::text AS "customerId", contact_name AS "contactName",
      phone, service_requested AS "serviceRequested", source, status, notes,
      requirement_json AS "requirementJson",
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
      to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
  `,
    [data.contactName, data.phone, data.serviceRequested, data.source, data.notes]
  );
  expectOne(result.rowCount, "Unable to create lead.");
  return result.rows[0];
}

export async function createCustomer(
  pool: Pool,
  input: CreateCustomerInput
): Promise<CustomerRecord> {
  const data = validateCustomer(input);
  const result = await pool.query<CustomerRecord>(
    `
    INSERT INTO sarathi.customers (name, phone, email, address)
    VALUES ($1, $2, $3, $4)
    RETURNING id::text, name, phone, email, address, 0 AS "projectCount",
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
  `,
    [data.name, data.phone, data.email, data.address]
  );
  expectOne(result.rowCount, "Unable to create customer.");
  return result.rows[0];
}

export async function updateLeadStatus(
  pool: Pool,
  rawId: string,
  rawStatus: string,
  rawExpected: string
): Promise<void> {
  const id = databaseId(rawId, "Lead");
  const status = leadStatus(rawStatus);
  const expected = leadStatus(rawExpected);
  if (status === "CONVERTED") throw new InputError("Convert this lead by creating a project.");
  await transaction(pool, async (client) => {
    const locked = await client.query<{ status: LeadStatus }>(
      `SELECT status FROM sarathi.leads WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const lead = locked.rows[0];
    if (!lead) throw new InputError("Lead no longer exists.");
    if (lead.status !== expected)
      throw new InputError("Lead changed since this page loaded. Refresh and try again.");
    const linked = await client.query(`SELECT id FROM sarathi.projects WHERE lead_id = $1`, [id]);
    if (linked.rowCount || lead.status === "CONVERTED") {
      throw new InputError("A converted lead cannot change status.");
    }
    if (lead.status === status) return;
    const updated = await client.query(
      `
      UPDATE sarathi.leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `,
      [status, id]
    );
    expectOne(updated.rowCount, "Lead no longer exists.");
  });
}

export async function createProject(
  pool: Pool,
  rawActorId: string,
  input: CreateProjectInput
): Promise<ProjectRecord> {
  const actorId = databaseId(rawActorId, "Administrator");
  const data = validateProject(input);
  return transaction(pool, async (client) => {
    const customer = await client.query(`SELECT id FROM sarathi.customers WHERE id = $1`, [
      data.customerId
    ]);
    if (!customer.rows[0]) throw new InputError("Customer no longer exists.");
    if (data.leadId) {
      // Every lead mutation locks this same row first, serializing conversion/status changes.
      const locked = await client.query<{ customerId: string | null; status: LeadStatus }>(
        `
        SELECT customer_id::text AS "customerId", status FROM sarathi.leads WHERE id = $1 FOR UPDATE
      `,
        [data.leadId]
      );
      const lead = locked.rows[0];
      if (!lead) throw new InputError("Lead no longer exists.");
      if (lead.customerId && lead.customerId !== data.customerId) {
        throw new InputError("Lead belongs to another customer.");
      }
      if (lead.status === "LOST") throw new InputError("Reopen this lead before converting it.");
      const existing = await client.query(`SELECT id FROM sarathi.projects WHERE lead_id = $1`, [
        data.leadId
      ]);
      if (lead.status === "CONVERTED" || existing.rowCount)
        throw new InputError("This lead has already been converted.");
    }
    const result = await client.query<ProjectRecord>(
      `
      INSERT INTO sarathi.projects (customer_id, lead_id, name, site_address, scope, service_types, operational_status)
      VALUES ($1, $2, $3, $4, $5, $6, 'SURVEY_PENDING')
      RETURNING id::text, customer_id::text AS "customerId",
        (SELECT name FROM sarathi.customers WHERE id = $1) AS "customerName",
        lead_id::text AS "leadId", name, site_address AS "siteAddress", scope,
        service_types AS "serviceTypes", operational_status AS "operationalStatus",
        on_hold AS "onHold", hold_reason AS "holdReason",
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
    `,
      [data.customerId, data.leadId, data.name, data.siteAddress, data.scope, data.serviceTypes]
    );
    expectOne(result.rowCount, "Unable to create project.");
    const project = result.rows[0];
    if (data.leadId) {
      const updated = await client.query(
        `
        UPDATE sarathi.leads SET status = 'CONVERTED', customer_id = $1,
          updated_at = CURRENT_TIMESTAMP WHERE id = $2
      `,
        [data.customerId, data.leadId]
      );
      expectOne(updated.rowCount, "Lead no longer exists.");
    }
    const history = await client.query(
      `
      INSERT INTO sarathi.status_history
        (project_id, from_status, to_status, was_on_hold, is_on_hold, reason, changed_by)
      VALUES ($1, NULL, 'SURVEY_PENDING', false, false, 'Project created', $2)
    `,
      [project.id, actorId]
    );
    expectOne(history.rowCount, "Unable to record project history.");
    return project;
  });
}

export async function updateProjectStatus(
  pool: Pool,
  rawActorId: string,
  rawId: string,
  rawStatus: string,
  rawExpected: string,
  rawReason?: string
): Promise<void> {
  const actorId = databaseId(rawActorId, "Administrator");
  const id = databaseId(rawId, "Project");
  const status = projectStatus(rawStatus);
  const expected = projectStatus(rawExpected);
  const reason = boundedText(rawReason ?? "", "Reason", 1000, false);
  await transaction(pool, async (client) => {
    const locked = await client.query<{ status: ProjectStatus; onHold: boolean }>(
      `
      SELECT operational_status AS status, on_hold AS "onHold" FROM sarathi.projects WHERE id = $1 FOR UPDATE
    `,
      [id]
    );
    const project = locked.rows[0];
    if (!project) throw new InputError("Project no longer exists.");
    if (project.status !== expected)
      throw new InputError("Project changed since this page loaded. Refresh and try again.");
    if (project.status === status) return;
    if (project.onHold)
      throw new InputError("Release this project's hold before changing its stage.");
    if (requiresProjectTransitionReason(project.status, status) && !reason) {
      throw new InputError("Provide a reason to skip, reverse, cancel, or reopen a project stage.");
    }
    const updated = await client.query(
      `
      UPDATE sarathi.projects SET operational_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `,
      [status, id]
    );
    expectOne(updated.rowCount, "Project no longer exists.");
    const history = await client.query(
      `
      INSERT INTO sarathi.status_history
        (project_id, from_status, to_status, was_on_hold, is_on_hold, reason, changed_by)
      VALUES ($1, $2, $3, $4, $4, $5, $6)
    `,
      [id, project.status, status, project.onHold, reason || null, actorId]
    );
    expectOne(history.rowCount, "Unable to record project history.");
  });
}
