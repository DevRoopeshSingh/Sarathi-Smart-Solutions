import "server-only";
import { getListPage, customerOptions, projectCounts, type ListQuery } from "./lists";
import { getAuth } from "./auth";
import { getPool } from "./db";

import type {
  AdminActor,
  LeadRecord,
  CustomerRecord,
  ProjectRecord,
  QuotationRecord,
  PaymentRecord
} from "../lib/operations";
export type {
  AdminActor,
  LeadRecord,
  CustomerRecord,
  ProjectRecord,
  QuotationRecord,
  PaymentRecord
} from "../lib/operations";
import { AccessDeniedError } from "./mutation-errors";
export { AccessDeniedError } from "./mutation-errors";
import * as business from "./business";
import type { CreateLeadInput, CreateCustomerInput, CreateProjectInput } from "./input";

export async function getAdminActor(headers: Headers): Promise<AdminActor | null> {
  const session = await getAuth().api.getSession({ headers, query: { disableCookieCache: true } });
  if (!session) return null;
  const result = await getPool().query<AdminActor>(
    `
    SELECT actor.id::text AS id, actor.display_name AS "displayName", identity.email
    FROM sarathi.users actor
    JOIN sarathi.auth_users identity ON identity.id = actor.identity_subject
    WHERE actor.identity_subject = $1 AND actor.active AND actor.role = 'ADMIN'
  `,
    [session.user.id]
  );
  return result.rows[0] ?? null;
}

export async function requireAdmin(headers: Headers): Promise<AdminActor> {
  const actor = await getAdminActor(headers);
  if (!actor) throw new AccessDeniedError();
  return actor;
}

export async function getAdminOverview(headers: Headers) {
  const actor = await requireAdmin(headers);
  const result = await getPool().query<{ leads: string; projects: string; quotations: string }>(
    `
    SELECT (SELECT count(*)::text FROM sarathi.leads) AS leads,
           (SELECT count(*)::text FROM sarathi.projects) AS projects,
           (SELECT count(*)::text FROM sarathi.quotations) AS quotations
    FROM sarathi.users WHERE id = $1 AND active AND role = 'ADMIN'
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

  const recentLeadsResult = await getPool().query<LeadRecord>(
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

  const recentProjectsResult = await getPool().query<ProjectRecord>(
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
  await requireAdmin(headers);
  return getListPage(getPool(), "leads", query);
}

export async function createLead(headers: Headers, data: CreateLeadInput) {
  await requireAdmin(headers);
  return business.createLead(getPool(), data);
}

export async function updateLeadStatus(
  headers: Headers,
  leadId: string,
  status: string,
  expectedStatus: string
) {
  await requireAdmin(headers);
  return business.updateLeadStatus(getPool(), leadId, status, expectedStatus);
}

export async function getCustomers(headers: Headers, query: ListQuery = {}) {
  await requireAdmin(headers);
  return getListPage(getPool(), "customers", query);
}

export async function createCustomer(headers: Headers, data: CreateCustomerInput) {
  await requireAdmin(headers);
  return business.createCustomer(getPool(), data);
}

export async function getProjects(headers: Headers, query: ListQuery = {}) {
  await requireAdmin(headers);
  return getListPage(getPool(), "projects", query);
}

export async function createProject(headers: Headers, data: CreateProjectInput) {
  const actor = await requireAdmin(headers);
  return business.createProject(getPool(), actor.id, data);
}

export async function updateProjectStatus(
  headers: Headers,
  projectId: string,
  operationalStatus: string,
  expectedStatus: string,
  reason?: string
) {
  const actor = await requireAdmin(headers);
  return business.updateProjectStatus(
    getPool(),
    actor.id,
    projectId,
    operationalStatus,
    expectedStatus,
    reason
  );
}

export async function getQuotations(headers: Headers, query: ListQuery = {}) {
  await requireAdmin(headers);
  return getListPage(getPool(), "quotes", query);
}

export async function getPayments(headers: Headers, query: ListQuery = {}) {
  await requireAdmin(headers);
  return getListPage(getPool(), "payments", query);
}

export async function getCustomerOptions(headers: Headers, query = "") {
  await requireAdmin(headers);
  return customerOptions(getPool(), query);
}
export async function getProjectCounts(headers: Headers) {
  await requireAdmin(headers);
  return projectCounts(getPool());
}
