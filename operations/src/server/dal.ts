import "server-only";
import { getListPage, customerOptions, projectCounts, type ListQuery } from "./lists";
import { getIdentityActor } from "./identity";
import { currentOrganization } from "./tenancy";
import { tenantPool } from "./tenant-pool";
import { getPool } from "./db";

import type {
  AdminActor,
  LeadRecord,
  CustomerRecord,
  ProjectRecord,
  QuotationRecord,
  PaymentRecord,
  ManagedUser
} from "../lib/operations";
import type { Permission, Role } from "./permissions";
import { isRole } from "./permissions";
import { databaseId } from "./input";
export type {
  AdminActor,
  LeadRecord,
  CustomerRecord,
  ProjectRecord,
  QuotationRecord,
  PaymentRecord,
  ManagedUser
} from "../lib/operations";
import { AccessDeniedError, InputError } from "./mutation-errors";
export { AccessDeniedError } from "./mutation-errors";
import * as business from "./business";
import type { CreateLeadInput, CreateCustomerInput, CreateProjectInput } from "./input";

export async function getActor(headers: Headers): Promise<AdminActor | null> {
  const identity = await getIdentityActor(headers);
  if (!identity) return null;
  try {
    const context = await currentOrganization(identity.id, "dashboard.read");
    const levels: Role[] = ["VIEWER", "OPERATOR", "ADMIN"];
    return {
      ...identity,
      role: levels[Math.min(levels.indexOf(identity.role), levels.indexOf(context.role))]
    };
  } catch (error) {
    if (error instanceof AccessDeniedError) return null;
    throw error;
  }
}

export async function authorizedDatabase(headers: Headers, permission: Permission) {
  const actor = await getIdentityActor(headers);
  if (!actor) throw new AccessDeniedError();
  const context = await currentOrganization(actor.id, permission);
  const levels: Role[] = ["VIEWER", "OPERATOR", "ADMIN"];
  const effectiveActor = {
    ...actor,
    role: levels[Math.min(levels.indexOf(actor.role), levels.indexOf(context.role))]
  };
  return {
    actor: effectiveActor,
    context,
    pool: tenantPool(getPool(), actor.id, context.organization.id, permission)
  };
}

export const getAdminActor = getActor;

export async function requireRole(headers: Headers, roles: readonly Role[]): Promise<AdminActor> {
  const actor = await getActor(headers);
  if (!actor || !roles.includes(actor.role)) throw new AccessDeniedError();
  return actor;
}

export async function requirePermission(
  headers: Headers,
  permission: Permission
): Promise<AdminActor> {
  const { actor } = await authorizedDatabase(headers, permission);
  return actor;
}

export async function requireAdmin(headers: Headers): Promise<AdminActor> {
  return requireRole(headers, ["ADMIN"]);
}

export async function getManagedUsers(headers: Headers): Promise<ManagedUser[]> {
  const { context, pool } = await authorizedDatabase(headers, "admin.users.manage");
  const result = await pool.query<ManagedUser>(
    `
    SELECT actor.id::text AS id, actor.display_name AS "displayName", identity.email,
           m.role, (actor.active AND m.active) AS active
    FROM sarathi.users actor
    JOIN sarathi.auth_users identity ON identity.id = actor.identity_subject
    JOIN sarathi.organization_memberships m ON m.user_id=actor.id AND m.organization_id=$1
    ORDER BY actor.display_name, identity.email
  `,
    [context.organization.id]
  );
  return result.rows.filter((user) => isRole(user.role));
}

export async function setManagedUserRole(
  headers: Headers,
  targetUserId: string,
  nextRole: string
): Promise<void> {
  const { actor, context, pool } = await authorizedDatabase(headers, "admin.users.manage");
  const targetId = databaseId(targetUserId, "User");
  if (!isRole(nextRole)) throw new InputError("Choose a valid role.");
  await pool.query("SELECT sarathi.admin_set_membership_role($1, $2, $3, $4)", [
    actor.id,
    context.organization.id,
    targetId,
    nextRole
  ]);
}

export async function getAdminOverview(headers: Headers) {
  const { actor, pool } = await authorizedDatabase(headers, "dashboard.read");
  const result = await pool.query<{ leads: string; projects: string; quotations: string }>(
    `
    SELECT (SELECT count(*)::text FROM sarathi.leads) AS leads,
           (SELECT count(*)::text FROM sarathi.projects) AS projects,
           (SELECT count(*)::text FROM sarathi.quotations) AS quotations
    FROM sarathi.users WHERE id = $1 AND active
  `,
    [actor.id]
  );
  if (!result.rows[0]) throw new AccessDeniedError();
  const counts = Object.fromEntries(
    Object.entries(result.rows[0]).map(([key, value]) => {
      const count = Number(value);
      if (!Number.isSafeInteger(count)) throw new Error("Count exceeds supported display range.");
      return [key, count];
    })
  ) as { leads: number; projects: number; quotations: number };

  const recentLeadsResult = await pool.query<LeadRecord>(
    `
    SELECT id::text, customer_id::text AS "customerId", contact_name AS "contactName",
           phone, service_requested AS "serviceRequested", source, status,
           notes, requirement_json AS "requirementJson",
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
           to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"
    FROM sarathi.leads
    ORDER BY created_at DESC
    LIMIT 5
  `
  );

  const recentProjectsResult = await pool.query<ProjectRecord>(
    `
    SELECT p.id::text, p.customer_id::text AS "customerId", c.name AS "customerName",
           p.lead_id::text AS "leadId", p.name, p.site_address AS "siteAddress",
           p.scope, p.service_types AS "serviceTypes",
           p.operational_status AS "operationalStatus", p.on_hold AS "onHold",
           p.hold_reason AS "holdReason",
           to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
    FROM sarathi.projects p
    JOIN sarathi.customers c ON c.id = p.customer_id
    ORDER BY p.created_at DESC
    LIMIT 5
  `
  );

  return {
    actor,
    counts,
    recentLeads: recentLeadsResult.rows,
    recentProjects: recentProjectsResult.rows
  };
}

export async function getLeads(headers: Headers, query: ListQuery = {}) {
  const { pool } = await authorizedDatabase(headers, "leads.read");
  return getListPage(pool, "leads", query);
}

export async function createLead(headers: Headers, data: CreateLeadInput) {
  const { pool } = await authorizedDatabase(headers, "leads.create");
  return business.createLead(pool, data);
}

export async function updateLeadStatus(
  headers: Headers,
  leadId: string,
  status: string,
  expectedStatus: string
) {
  const { pool } = await authorizedDatabase(headers, "leads.update");
  return business.updateLeadStatus(pool, leadId, status, expectedStatus);
}

export async function getCustomers(headers: Headers, query: ListQuery = {}) {
  const { pool } = await authorizedDatabase(headers, "customers.read");
  return getListPage(pool, "customers", query);
}

export async function createCustomer(
  headers: Headers,
  data: CreateCustomerInput,
  submission?: import("./customer-mutations").CustomerSubmission
) {
  const { pool } = await authorizedDatabase(headers, "customers.create");
  const { validateCustomerSubmission } = await import("./customer-mutations");
  return business.createCustomer(pool, data, validateCustomerSubmission(submission));
}
export async function updateCustomer(
  headers: Headers,
  id: string,
  data: CreateCustomerInput,
  version: string
) {
  const { pool } = await authorizedDatabase(headers, "customers.update");
  return business.updateCustomer(pool, id, data, version);
}

export async function getProjects(headers: Headers, query: ListQuery = {}) {
  const { pool } = await authorizedDatabase(headers, "projects.read");
  return getListPage(pool, "projects", query);
}

export async function createProject(headers: Headers, data: CreateProjectInput) {
  const { actor, pool } = await authorizedDatabase(headers, "projects.create");
  return business.createProject(pool, actor.id, data);
}

export async function updateProjectStatus(
  headers: Headers,
  projectId: string,
  operationalStatus: string,
  expectedStatus: string,
  reason?: string
) {
  const { actor, pool } = await authorizedDatabase(headers, "projects.update");
  return business.updateProjectStatus(
    pool,
    actor.id,
    projectId,
    operationalStatus,
    expectedStatus,
    reason
  );
}

export async function getQuotations(headers: Headers, query: ListQuery = {}) {
  const { pool } = await authorizedDatabase(headers, "quotations.read");
  return getListPage(pool, "quotes", query);
}

export async function getPayments(headers: Headers, query: ListQuery = {}) {
  const { pool } = await authorizedDatabase(headers, "payments.read");
  return getListPage(pool, "payments", query);
}

export async function getCustomerOptions(headers: Headers, query = "") {
  const { pool } = await authorizedDatabase(headers, "customers.read");
  return customerOptions(pool, query);
}
export async function getProjectCounts(headers: Headers) {
  const { pool } = await authorizedDatabase(headers, "projects.read");
  return projectCounts(pool);
}
