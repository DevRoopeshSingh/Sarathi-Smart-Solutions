import "server-only";
import { authorizedDatabase } from "./dal";
import { databaseId } from "./input";
import { InputError, AccessDeniedError } from "./mutation-errors";
import type { CustomerRecord } from "../lib/operations";
import type { SearchParameters } from "./lists";
export const CUSTOMER_SECTIONS = ["leads", "projects", "activity", "quotes", "payments"] as const;
export type CustomerSection = (typeof CUSTOMER_SECTIONS)[number];
export interface CustomerLinkRecord {
  id: string;
  title: string;
  status: string;
  division: string | null;
  services: string[];
  detail: string | null;
  at: string;
  source: string;
  actor: string | null;
}
export async function getCustomerProfile(
  headers: Headers,
  rawId: string,
  params: SearchParameters = {}
) {
  const { pool, context } = await authorizedDatabase(headers, "customers.read");
  const id = databaseId(rawId, "Customer");
  const customer = await pool.query<CustomerRecord>(
    `SELECT c.id::text,c.name,c.phone,c.email,c.address,c.version,
    c.created_at::text AS "createdAt",c.updated_at::text AS "updatedAt",
    (SELECT count(*)::int FROM sarathi.projects p WHERE p.customer_id=c.id) AS "projectCount"
    FROM sarathi.customers c WHERE c.id=$1`,
    [id]
  );
  if (!customer.rows[0]) return null;
  const canReadPayments = context.permissions.includes("payments.read");
  const section: CustomerSection =
    typeof params.section === "string" &&
    CUSTOMER_SECTIONS.includes(params.section as CustomerSection)
      ? (params.section as CustomerSection)
      : "projects";
  if (section === "payments" && !canReadPayments) throw new AccessDeniedError();
  let cursor: { at: string; source: string; id: string } | null = null;
  const after = typeof params.after === "string" ? params.after : "";
  if (after) {
    try {
      if (after.length > 256) throw new Error();
      cursor = JSON.parse(Buffer.from(after, "base64url").toString());
      if (
        !cursor ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.at) ||
        !["customer", "project"].includes(cursor.source)
      )
        throw new Error();
      databaseId(cursor.id);
      const parsed = Date.parse(cursor.at);
      if (
        !Number.isFinite(parsed) ||
        cursor.at.startsWith("0000") ||
        new Date(parsed).toISOString().slice(0, 19) !== cursor.at.slice(0, 19)
      )
        throw new Error();
    } catch {
      throw new InputError("Invalid history page. Open the customer's first page.");
    }
  }
  // All queries use the same RLS-protected pool. Division names and service types
  // come exclusively from visible records, including the union's stage-history branch.
  const date = (column: string) =>
    `to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
  const common = `d.name AS division,ARRAY[]::text[] AS services,NULL::text AS actor`;
  const queries: Record<CustomerSection, string> = {
    leads: `SELECT l.id::text,l.contact_name AS title,l.status,${common},l.service_requested AS detail,${date("l.created_at")} AS at,'project' AS source
      FROM sarathi.leads l JOIN sarathi.divisions d ON d.organization_id=l.organization_id AND d.id=l.division_id WHERE l.customer_id=$1`,
    projects: `SELECT p.id::text,p.name AS title,p.operational_status AS status,d.name AS division,p.service_types AS services,
      CASE WHEN p.on_hold THEN 'On hold: ' || coalesce(p.hold_reason,'') ELSE p.site_address END AS detail,NULL::text AS actor,${date("p.created_at")} AS at,'project' AS source
      FROM sarathi.projects p JOIN sarathi.divisions d ON d.organization_id=p.organization_id AND d.id=p.division_id WHERE p.customer_id=$1`,
    quotes: `SELECT q.id::text,coalesce(p.name,q.title) AS title,q.status,${common},'Version ' || q.version || ' · INR ' || q.total::text AS detail,${date("q.created_at")} AS at,'project' AS source
      FROM sarathi.quotations q LEFT JOIN sarathi.projects p ON p.id=q.project_id AND p.organization_id=q.organization_id
      JOIN sarathi.divisions d ON d.organization_id=q.organization_id AND d.id=coalesce(q.division_id,p.division_id) WHERE q.customer_id=$1`,
    payments: `SELECT pay.id::text,coalesce(pay.receipt_number,p.name,q.title) AS title,pay.kind AS status,${common},'INR ' || pay.amount::text || ' · ' || pay.payment_method || coalesce(' · ' || pay.reference,'') AS detail,${date("pay.created_at")} AS at,'project' AS source
      FROM sarathi.payments pay LEFT JOIN sarathi.projects p ON p.id=pay.project_id AND p.organization_id=pay.organization_id
      LEFT JOIN sarathi.quotations q ON q.id=pay.quotation_id AND q.organization_id=pay.organization_id
      JOIN sarathi.divisions d ON d.organization_id=pay.organization_id AND d.id=coalesce(pay.division_id,p.division_id,q.division_id) WHERE coalesce(pay.customer_id,p.customer_id,q.customer_id)=$1`,
    activity: `SELECT h.id::text,p.name AS title,h.to_status AS status,d.name AS division,p.service_types AS services,
      h.reason AS detail,u.display_name AS actor,${date("h.changed_at")} AS at,'project' AS source
      FROM sarathi.status_history h JOIN sarathi.projects p ON p.id=h.project_id AND p.organization_id=h.organization_id
      JOIN sarathi.divisions d ON d.id=p.division_id AND d.organization_id=p.organization_id
      LEFT JOIN sarathi.users u ON u.id=h.changed_by WHERE p.customer_id=$1
      UNION ALL SELECT a.id::text,'Customer details updated' AS title,'UPDATED' AS status,NULL::text AS division,ARRAY[]::text[] AS services,
      array_to_string(a.changed_fields,', ') AS detail,coalesce(u.display_name,'Owner maintenance') AS actor,${date("a.changed_at")} AS at,'customer' AS source
      FROM sarathi.customer_changes a LEFT JOIN sarathi.users u ON u.id=a.changed_by WHERE a.customer_id=$1`
  };
  const rows = await pool.query<CustomerLinkRecord>(
    `SELECT * FROM (${queries[section]}) records
    WHERE ($2::timestamptz IS NULL OR (at::timestamptz,source,id::bigint)<($2::timestamptz,$3::text,$4::bigint))
    ORDER BY at::timestamptz DESC,source DESC,id::bigint DESC LIMIT 26`,
    [id, cursor?.at ?? null, cursor?.source ?? null, cursor?.id ?? null]
  );
  const items = rows.rows.slice(0, 25);
  const last = items.at(-1);
  return {
    customer: customer.rows[0],
    items,
    section,
    canEdit: context.permissions.includes("customers.update"),
    canReadPayments,
    next:
      rows.rows.length > 25 && last
        ? Buffer.from(JSON.stringify({ at: last.at, source: last.source, id: last.id })).toString(
            "base64url"
          )
        : null
  };
}
