import "server-only";
import { getAuth } from "./auth";
import { getPool } from "./db";

export interface AdminActor {
  id: string;
  displayName: string;
  email: string;
}

export interface LeadRecord {
  id: number;
  customerId: number | null;
  contactName: string;
  phone: string;
  serviceRequested: string;
  source: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  notes: string | null;
  requirementJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRecord {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  projectCount: number;
  createdAt: string;
}

export interface ProjectRecord {
  id: number;
  customerId: number;
  customerName: string;
  leadId: number | null;
  name: string;
  siteAddress: string;
  scope: string;
  serviceTypes: string[];
  operationalStatus: string;
  onHold: boolean;
  holdReason: string | null;
  createdAt: string;
}

export interface QuotationRecord {
  id: number;
  projectId: number;
  projectName: string;
  customerId: number;
  customerName: string;
  version: number;
  status: "DRAFT" | "SENT" | "APPROVED" | "DECLINED" | "SUPERSEDED" | "VOID";
  subtotal: string;
  discount: string;
  taxAmount: string;
  quoteTotal: string;
  issuedAt: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: number;
  projectId: number;
  projectName: string;
  quotationId: number | null;
  kind: "RECEIPT" | "REFUND";
  amount: string;
  paymentMethod: string;
  reference: string;
  createdAt: string;
}

export class AccessDeniedError extends Error {
  constructor() {
    super("Administrator access is required.");
    this.name = "AccessDeniedError";
  }
}

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
    SELECT id, customer_id AS "customerId", contact_name AS "contactName",
           phone, service_requested AS "serviceRequested", source, status,
           notes, requirement_json AS "requirementJson",
           to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt",
           to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
    FROM sarathi.leads
    ORDER BY created_at DESC
    LIMIT 5
  `
  );

  const recentProjectsResult = await getPool().query<ProjectRecord>(
    `
    SELECT p.id, p.customer_id AS "customerId", c.name AS "customerName",
           p.lead_id AS "leadId", p.name, p.site_address AS "siteAddress",
           p.scope, p.service_types AS "serviceTypes",
           p.operational_status AS "operationalStatus", p.on_hold AS "onHold",
           p.hold_reason AS "holdReason",
           to_char(p.created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
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

export async function getLeads(headers: Headers): Promise<LeadRecord[]> {
  await requireAdmin(headers);
  const result = await getPool().query<LeadRecord>(
    `
    SELECT id, customer_id AS "customerId", contact_name AS "contactName",
           phone, service_requested AS "serviceRequested", source, status,
           notes, requirement_json AS "requirementJson",
           to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt",
           to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
    FROM sarathi.leads
    ORDER BY created_at DESC
  `
  );
  return result.rows;
}

export async function createLead(
  headers: Headers,
  data: {
    contactName: string;
    phone: string;
    serviceRequested: string;
    source?: string;
    notes?: string;
  }
): Promise<LeadRecord> {
  await requireAdmin(headers);
  const contactName = data.contactName.trim();
  const phone = data.phone.trim();
  const serviceRequested = data.serviceRequested.trim();
  const source = (data.source || "MANUAL").trim();
  const notes = data.notes?.trim() || null;

  if (!contactName || !phone || !serviceRequested) {
    throw new Error("Name, phone, and service are required.");
  }

  const result = await getPool().query<LeadRecord>(
    `
    INSERT INTO sarathi.leads (contact_name, phone, service_requested, source, notes, status)
    VALUES ($1, $2, $3, $4, $5, 'NEW')
    RETURNING id, customer_id AS "customerId", contact_name AS "contactName",
              phone, service_requested AS "serviceRequested", source, status,
              notes, requirement_json AS "requirementJson",
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt",
              to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
  `,
    [contactName, phone, serviceRequested, source, notes]
  );
  return result.rows[0];
}

export async function updateLeadStatus(
  headers: Headers,
  leadId: number,
  status: string
): Promise<void> {
  await requireAdmin(headers);
  const valid = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];
  if (!valid.includes(status)) throw new Error("Invalid status.");
  await getPool().query(
    `UPDATE sarathi.leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [status, leadId]
  );
}

export async function getCustomers(headers: Headers): Promise<CustomerRecord[]> {
  await requireAdmin(headers);
  const result = await getPool().query<CustomerRecord>(
    `
    SELECT c.id, c.name, c.phone, c.email, c.address,
           count(p.id)::int AS "projectCount",
           to_char(c.created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
    FROM sarathi.customers c
    LEFT JOIN sarathi.projects p ON p.customer_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `
  );
  return result.rows;
}

export async function createCustomer(
  headers: Headers,
  data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  }
): Promise<CustomerRecord> {
  await requireAdmin(headers);
  const name = data.name.trim();
  const phone = data.phone.trim();
  const email = data.email?.trim() || null;
  const address = data.address?.trim() || null;

  if (!name || !phone) throw new Error("Customer name and phone are required.");

  const result = await getPool().query<CustomerRecord>(
    `
    INSERT INTO sarathi.customers (name, phone, email, address)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, phone, email, address, 0 AS "projectCount",
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
  `,
    [name, phone, email, address]
  );
  return result.rows[0];
}

export async function getProjects(headers: Headers): Promise<ProjectRecord[]> {
  await requireAdmin(headers);
  const result = await getPool().query<ProjectRecord>(
    `
    SELECT p.id, p.customer_id AS "customerId", c.name AS "customerName",
           p.lead_id AS "leadId", p.name, p.site_address AS "siteAddress",
           p.scope, p.service_types AS "serviceTypes",
           p.operational_status AS "operationalStatus", p.on_hold AS "onHold",
           p.hold_reason AS "holdReason",
           to_char(p.created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
    FROM sarathi.projects p
    JOIN sarathi.customers c ON c.id = p.customer_id
    ORDER BY p.created_at DESC
  `
  );
  return result.rows;
}

export async function createProject(
  headers: Headers,
  data: {
    customerId: number;
    name: string;
    siteAddress: string;
    scope?: string;
    serviceTypes?: string[];
    leadId?: number;
  }
): Promise<ProjectRecord> {
  await requireAdmin(headers);
  const name = data.name.trim();
  const siteAddress = data.siteAddress.trim();
  const scope = data.scope?.trim() || "";
  const serviceTypes = data.serviceTypes || ["cctv"];
  const customerId = data.customerId;
  const leadId = data.leadId || null;

  if (!name || !siteAddress || !customerId) {
    throw new Error("Customer, project name, and site address are required.");
  }

  const result = await getPool().query<ProjectRecord>(
    `
    INSERT INTO sarathi.projects (customer_id, lead_id, name, site_address, scope, service_types, operational_status)
    VALUES ($1, $2, $3, $4, $5, $6, 'SURVEY_PENDING')
    RETURNING id, customer_id AS "customerId",
              (SELECT name FROM sarathi.customers WHERE id = $1) AS "customerName",
              lead_id AS "leadId", name, site_address AS "siteAddress", scope, service_types AS "serviceTypes",
              operational_status AS "operationalStatus", on_hold AS "onHold", hold_reason AS "holdReason",
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
  `,
    [customerId, leadId, name, siteAddress, scope, serviceTypes]
  );

  if (leadId) {
    await getPool().query(
      `UPDATE sarathi.leads SET status = 'CONVERTED', customer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [customerId, leadId]
    );
  }

  return result.rows[0];
}

export async function updateProjectStatus(
  headers: Headers,
  projectId: number,
  operationalStatus: string
): Promise<void> {
  await requireAdmin(headers);
  const valid = [
    "SURVEY_PENDING",
    "SURVEY_COMPLETE",
    "COSTING",
    "PROCUREMENT",
    "INSTALLATION_SCHEDULED",
    "INSTALLATION_IN_PROGRESS",
    "TESTING",
    "COMPLETED",
    "CANCELLED"
  ];
  if (!valid.includes(operationalStatus)) throw new Error("Invalid operational status.");
  await getPool().query(
    `UPDATE sarathi.projects SET operational_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [operationalStatus, projectId]
  );
}

export async function getQuotations(headers: Headers): Promise<QuotationRecord[]> {
  await requireAdmin(headers);
  const result = await getPool().query<QuotationRecord>(
    `
    SELECT q.id, q.project_id AS "projectId", p.name AS "projectName",
           q.customer_id AS "customerId", c.name AS "customerName",
           q.version, q.status,
           q.subtotal::text, q.discount::text, q.tax_amount::text AS "taxAmount",
           q.total::text AS "quoteTotal",
           to_char(q.sent_at, 'YYYY-MM-DD HH24:MI') AS "issuedAt",
           to_char(q.created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
    FROM sarathi.quotations q
    JOIN sarathi.projects p ON p.id = q.project_id
    JOIN sarathi.customers c ON c.id = q.customer_id
    ORDER BY q.created_at DESC
  `
  );
  return result.rows;
}

export async function getPayments(headers: Headers): Promise<PaymentRecord[]> {
  await requireAdmin(headers);
  const result = await getPool().query<PaymentRecord>(
    `
    SELECT pay.id, pay.project_id AS "projectId", p.name AS "projectName",
           pay.quotation_id AS "quotationId", pay.kind,
           pay.amount::text, pay.payment_method AS "paymentMethod", pay.reference,
           to_char(pay.created_at, 'YYYY-MM-DD HH24:MI') AS "createdAt"
    FROM sarathi.payments pay
    JOIN sarathi.projects p ON p.id = pay.project_id
    ORDER BY pay.created_at DESC
  `
  );
  return result.rows;
}
