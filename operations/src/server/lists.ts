import "server-only";
import type { Pool } from "pg";
import type {
  LeadRecord,
  CustomerRecord,
  ProjectRecord,
  QuotationRecord,
  PaymentRecord,
  CustomerOption
} from "../lib/operations";
import { databaseId, boundedText } from "./input";
export type ListQuery = { q?: string; status?: string; after?: string };
export type SearchParameters = Record<string, string | string[] | undefined>;
export interface ListPage<T> {
  items: T[];
  total: number;
  next: string | null;
}
type Records = {
  leads: LeadRecord;
  customers: CustomerRecord;
  projects: ProjectRecord;
  quotes: QuotationRecord;
  payments: PaymentRecord;
};
const lists = {
  leads: {
    select: `SELECT id::text, customer_id::text AS "customerId", contact_name AS "contactName",
           phone, service_requested AS "serviceRequested", source, status,
           notes, requirement_json AS "requirementJson",
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
           to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAt"`,
    from: `FROM sarathi.leads`,
    id: "leads.id",
    search: "concat_ws(' ', contact_name, phone, service_requested)",
    status: "status"
  },
  customers: {
    select: `SELECT c.id::text, c.name, c.phone, c.email, c.address,
           (SELECT count(*)::int FROM sarathi.projects p WHERE p.customer_id=c.id) AS "projectCount",
           to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
    `,
    from: `FROM sarathi.customers c`,
    id: "c.id",
    search: "concat_ws(' ', c.name, c.phone, c.address)",
    status: "''"
  },
  projects: {
    select: `SELECT p.id::text, p.customer_id::text AS "customerId", c.name AS "customerName",
           p.lead_id::text AS "leadId", p.name, p.site_address AS "siteAddress",
           p.scope, p.service_types AS "serviceTypes",
           p.operational_status AS "operationalStatus", p.on_hold AS "onHold",
           p.hold_reason AS "holdReason",
           to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"`,
    from: `FROM sarathi.projects p
    JOIN sarathi.customers c ON c.id = p.customer_id`,
    id: "p.id",
    search: "concat_ws(' ', p.name, c.name, p.site_address, p.scope)",
    status: "p.operational_status"
  },
  quotes: {
    select: `SELECT q.id::text, q.project_id::text AS "projectId", p.name AS "projectName",
           q.customer_id::text AS "customerId", c.name AS "customerName",
           q.version, q.status,
           q.subtotal::text, q.discount::text, q.tax_amount::text AS "taxAmount",
           q.total::text AS "quoteTotal",
           to_char(q.sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "issuedAt",
           to_char(q.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"`,
    from: `FROM sarathi.quotations q
    JOIN sarathi.projects p ON p.id = q.project_id
    JOIN sarathi.customers c ON c.id = q.customer_id`,
    id: "q.id",
    search: "concat_ws(' ', p.name, c.name)",
    status: "q.status"
  },
  payments: {
    select: `SELECT pay.id::text, pay.project_id::text AS "projectId", p.name AS "projectName",
           pay.quotation_id::text AS "quotationId", pay.kind,
           pay.amount::text, pay.payment_method AS "paymentMethod", pay.reference,
           to_char(pay.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"`,
    from: `FROM sarathi.payments pay
    JOIN sarathi.projects p ON p.id = pay.project_id`,
    id: "pay.id",
    search: "concat_ws(' ', p.name, pay.reference)",
    status: "pay.kind"
  }
} as const;
export function readListQuery(params: SearchParameters): ListQuery {
  const text = (name: string) => (typeof params[name] === "string" ? (params[name] as string) : "");
  const q = text("q").replace(/\0/g, "").trim().slice(0, 100);
  const status = text("status").slice(0, 40);
  let after = text("after");
  try {
    if (after) databaseId(after);
  } catch {
    after = "";
  }
  return { q, status: status === "ALL" ? "" : status, after };
}
const pattern = (q: string) => `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
export async function getListPage<K extends keyof Records>(
  pool: Pool,
  kind: K,
  input: ListQuery
): Promise<ListPage<Records[K]>> {
  const config = lists[kind];
  const query = readListQuery(input);
  const filter = ` WHERE ($1 = '' OR ${config.search} ILIKE $1) AND ($2 = '' OR ${config.status} = $2)`;
  const values = [query.q ? pattern(query.q) : "", query.status || ""];
  const [rows, counts] = await Promise.all([
    pool.query<Records[K]>(
      `${config.select} ${config.from}${filter}
      AND ($3::bigint IS NULL OR ${config.id} < $3::bigint)
      ORDER BY ${config.id} DESC LIMIT 51`,
      [...values, query.after || null]
    ),
    pool.query<{ total: string }>(`SELECT count(*)::text AS total ${config.from}${filter}`, values)
  ]);
  const total = Number(counts.rows[0].total);
  if (!Number.isSafeInteger(total)) throw new Error("Record count exceeds supported range.");
  const items = rows.rows.slice(0, 50);
  return { items, total, next: rows.rows.length > 50 ? items.at(-1)!.id : null };
}
export async function customerOptions(pool: Pool, input: string): Promise<CustomerOption[]> {
  const q = boundedText(input, "Search", 100, false);
  const result = await pool.query<CustomerOption>(
    `SELECT id::text, name, phone
    FROM sarathi.customers WHERE ($1='' OR concat_ws(' ',name,phone) ILIKE $1)
    ORDER BY customers.id DESC LIMIT 25`,
    [q ? pattern(q) : ""]
  );
  return result.rows;
}
export async function projectCounts(pool: Pool): Promise<Record<string, number>> {
  const result = await pool.query<{
    status: string;
    count: string;
  }>(`SELECT operational_status AS status, count(*)::text AS count
    FROM sarathi.projects GROUP BY operational_status`);
  const counts: Record<string, number> = { ALL: 0 };
  for (const row of result.rows) {
    const count = Number(row.count);
    if (!Number.isSafeInteger(count)) throw new Error("Record count exceeds supported range.");
    counts[row.status] = count;
    counts.ALL += count;
  }
  return counts;
}
