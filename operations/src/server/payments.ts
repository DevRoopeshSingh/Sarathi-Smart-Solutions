import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { authorizedDatabase } from "./dal";
import { transaction } from "./transaction";
import type { TenantPool } from "./tenant-pool";
import { boundedText, databaseId } from "./input";
import { requestId, documentSettings } from "./quotation-input";
import { paymentAmount, validatePayment } from "./payment-input";
import { InputError } from "./mutation-errors";
import { minor } from "../lib/quotation-money";
import {
  ledgerBalance,
  receiptRemaining,
  type Payment,
  type PaymentBalance,
  type PaymentInput,
  type PaymentSnapshot
} from "../lib/payments";
import { renderPayment, PAYMENT_RENDERER_VERSION } from "./documents/payment";
import { readListQuery, type ListQuery, type ListPage } from "./lists";
type Database = Pick<PoolClient, "query"> | TenantPool;
const paymentSelect = `SELECT pay.id::text,pay.kind,pay.amount::text,pay.receipt_number AS number,
 pay.project_id::text AS "projectId",p.name AS "projectName",pay.quotation_id::text AS "quotationId",q.quote_number AS "quotationNumber",
 coalesce(q.root_quotation_id,q.id)::text AS "rootId",coalesce(pay.customer_id,p.customer_id,q.customer_id)::text AS "customerId",c.name AS "customerName",
 coalesce(pay.division_id,p.division_id,q.division_id)::text AS "divisionId",d.name AS "divisionName",pay.payment_method AS method,pay.reference,pay.note,pay.purpose,
 to_char(pay.occurred_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "occurredAt",
 to_char(pay.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "recordedAt",u.display_name AS "recordedBy",pay.refund_of_id::text AS "refundOfId",
 EXISTS(SELECT 1 FROM sarathi.payment_documents doc WHERE doc.payment_id=pay.id) AS "hasDocument",pay.creation_request_id IS NOT NULL AS current,
 coalesce((SELECT sum(r.amount) FROM sarathi.payments r WHERE r.refund_of_id=pay.id),0)::text AS refunded,
 coalesce((SELECT sum(a.amount) FROM sarathi.payment_allocations a WHERE a.receipt_id=pay.id),0)::text AS allocated`;
const paymentFrom = `FROM sarathi.payments pay LEFT JOIN sarathi.projects p ON p.id=pay.project_id
 LEFT JOIN sarathi.quotations q ON q.id=pay.quotation_id JOIN sarathi.customers c ON c.id=coalesce(pay.customer_id,p.customer_id,q.customer_id)
 JOIN sarathi.divisions d ON d.id=coalesce(pay.division_id,p.division_id,q.division_id) JOIN sarathi.users u ON u.id=pay.recorded_by`;
async function readPaymentRow(db: Database, rawId: string): Promise<Payment> {
  const row = (
    await db.query<Payment>(paymentSelect + " " + paymentFrom + " WHERE pay.id=$1", [
      databaseId(rawId)
    ])
  ).rows[0];
  if (!row) throw new InputError("Payment is unavailable or you do not have access.");
  return row;
}
export async function readPayment(pool: TenantPool, rawId: string) {
  return readPaymentRow(pool, rawId);
}
interface Target {
  projectId: string | null;
  quotationId: string | null;
  customerId: string;
  divisionId: string;
  rootId: string | null;
}
async function target(
  db: Database,
  projectId: string | null,
  quotationId: string | null
): Promise<Target> {
  if (quotationId) {
    const q = (
      await db.query<Target & { status: string }>(
        `SELECT q.project_id::text AS "projectId",q.id::text AS "quotationId",q.customer_id::text AS "customerId",coalesce(q.division_id,p.division_id)::text AS "divisionId",coalesce(q.root_quotation_id,q.id)::text AS "rootId",q.status FROM sarathi.quotations q LEFT JOIN sarathi.projects p ON p.id=q.project_id WHERE q.id=$1`,
        [quotationId]
      )
    ).rows[0];
    if (!q || q.status !== "APPROVED" || (projectId && projectId !== q.projectId))
      throw new InputError("Select an accepted quotation in the authorized project or division.");
    return q;
  }
  const p = (
    await db.query<Target>(
      `SELECT id::text AS "projectId",NULL::text AS "quotationId",customer_id::text AS "customerId",division_id::text AS "divisionId",NULL::text AS "rootId" FROM sarathi.projects WHERE id=$1`,
      [projectId]
    )
  ).rows[0];
  if (!p) throw new InputError("Select an authorized project or accepted quotation.");
  return p;
}
async function lockTarget(client: PoolClient, value: Pick<Target, "projectId" | "rootId">) {
  const key = value.projectId ? "quote-project:" + value.projectId : "quote-family:" + value.rootId;
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [key]);
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function recordPayment(
  pool: TenantPool,
  actorId: string,
  input: PaymentInput,
  rawKey: string,
  renderer: typeof renderPayment = renderPayment
) {
  const data = validatePayment(input),
    key = requestId(rawKey),
    payloadHash = hash(data);
  if (pool.actorId !== actorId)
    throw new InputError("Payment actor must match the authenticated session.");
  return transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "payment-request:" + actorId + ":" + key
    ]);
    const existing = (
      await client.query<{ id: string; hash: string; number: string }>(
        `SELECT id::text,creation_request_hash AS hash,receipt_number AS number FROM sarathi.payments WHERE recorded_by=$1 AND creation_request_id=$2`,
        [actorId, key]
      )
    ).rows[0];
    if (existing) {
      if (existing.hash !== payloadHash)
        throw new InputError(
          "This submission was saved with different details. Open the saved receipt before retrying."
        );
      return { id: existing.id, number: existing.number };
    }
    let owned: Target,
      original: Payment | null = null;
    if (data.refundOfId) {
      original = await readPaymentRow(client, data.refundOfId);
      await lockTarget(client, original);
      original = await readPaymentRow(client, data.refundOfId);
      if (original.kind !== "RECEIPT" || !original.current || !original.hasDocument)
        throw new InputError(
          "Refunds require a current receipt. Historical records need owner reconciliation."
        );
      if (minor(data.amount) > minor(receiptRemaining(original).refundable))
        throw new InputError("Refund exceeds the original receipt's remaining amount.");
      owned = original;
    } else {
      owned = await target(client, data.projectId, data.quotationId);
      await lockTarget(client, owned);
      owned = await target(client, data.projectId, data.quotationId);
    }
    const row = (
      await client.query<{ id: string; number: string }>(
        `INSERT INTO sarathi.payments
 (project_id,quotation_id,customer_id,division_id,kind,amount,idempotency_key,payment_method,reference,note,occurred_at,purpose,refund_of_id,creation_request_id,creation_request_hash)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id::text,receipt_number AS number`,
        [
          owned.projectId,
          owned.quotationId,
          owned.customerId,
          owned.divisionId,
          original ? "REFUND" : "RECEIPT",
          data.amount,
          "current:" + actorId + ":" + key,
          data.method,
          data.reference || null,
          data.note || null,
          data.occurredAt,
          data.purpose,
          data.refundOfId,
          key,
          payloadHash
        ]
      )
    ).rows[0];
    const p = await readPaymentRow(client, row.id);
    const customer = (
      await client.query<{ name: string; phone: string; address: string | null }>(
        "SELECT name,phone,address FROM sarathi.customers WHERE id=$1",
        [p.customerId]
      )
    ).rows[0];
    const profile = (
      await client.query<{ name: string; settings: unknown }>(
        `SELECT concat_ws(' ',o.name,d.name) AS name,d.document_settings AS settings FROM sarathi.divisions d JOIN sarathi.organizations o ON o.id=d.organization_id WHERE d.id=$1`,
        [p.divisionId]
      )
    ).rows[0];
    const settings = documentSettings(profile.settings);
    const snapshot: PaymentSnapshot = {
      id: p.id,
      number: row.number,
      kind: p.kind,
      amount: p.amount,
      business: {
        name: settings.legalName || boundedText(profile.name, "Business name", 200),
        address: settings.address ?? "",
        phone: settings.phone ?? "",
        email: settings.email ?? ""
      },
      customer,
      project: p.projectName,
      quotation: p.quotationNumber,
      originalReceipt: original?.number ?? null,
      method: p.method,
      purpose: p.purpose!,
      reference: p.reference,
      note: p.note,
      occurredAt: p.occurredAt,
      recordedAt: p.recordedAt,
      recordedBy: p.recordedBy
    };
    const pdf = await renderer(snapshot);
    await client.query(
      "INSERT INTO sarathi.payment_documents(payment_id,snapshot,pdf,sha256,renderer_version) VALUES($1,$2,$3,$4,$5)",
      [
        p.id,
        snapshot,
        pdf,
        createHash("sha256").update(pdf).digest("hex"),
        PAYMENT_RENDERER_VERSION
      ]
    );
    return row;
  });
}
export async function allocatePayment(
  pool: TenantPool,
  rawReceipt: string,
  rawQuote: string,
  rawAmount: string,
  rawKey: string
) {
  const receiptId = databaseId(rawReceipt),
    quotationId = databaseId(rawQuote),
    amount = paymentAmount(rawAmount),
    key = requestId(rawKey),
    payloadHash = hash({ receiptId, quotationId, amount });
  return transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "allocation-request:" + pool.actorId + ":" + key
    ]);
    const existing = (
      await client.query<{ hash: string; id: string }>(
        `SELECT request_hash AS hash,id::text FROM sarathi.payment_allocations WHERE created_by=$1 AND request_id=$2`,
        [pool.actorId, key]
      )
    ).rows[0];
    if (existing) {
      if (existing.hash !== payloadHash)
        throw new InputError("This allocation submission was saved with different details.");
      return { id: receiptId };
    }
    let receipt = await readPaymentRow(client, receiptId);
    await lockTarget(client, receipt);
    receipt = await readPaymentRow(client, receiptId);
    const quote = await target(client, receipt.projectId, quotationId);
    if (
      receipt.kind !== "RECEIPT" ||
      !receipt.current ||
      (receipt.projectId === null && receipt.rootId !== quote.rootId) ||
      quote.customerId !== receipt.customerId ||
      quote.divisionId !== receipt.divisionId
    )
      throw new InputError(
        "Allocate only within the original customer, division and project or quotation family."
      );
    if (minor(amount) > minor(receiptRemaining(receipt).unallocated))
      throw new InputError("Allocation exceeds the unallocated receipt amount.");
    await client.query(
      "INSERT INTO sarathi.payment_allocations(receipt_id,quotation_id,amount,request_id,request_hash) VALUES($1,$2,$3,$4,$5)",
      [receiptId, quotationId, amount, key, payloadHash]
    );
    return { id: receiptId };
  });
}
async function balanceFor(
  db: Database,
  owned: Pick<Target, "projectId" | "rootId">
): Promise<PaymentBalance> {
  const row = (
    await db.query<{
      baselineId: string | null;
      baselineNumber: string | null;
      total: string | null;
      received: string;
      refunded: string;
      reversed: string;
    }>(
      `
 WITH baseline AS (SELECT id,quote_number,total FROM sarathi.quotations WHERE status='APPROVED'
 AND (($1::bigint IS NOT NULL AND project_id=$1) OR ($1::bigint IS NULL AND coalesce(root_quotation_id,id)=$2)) LIMIT 1),
 ledger AS (SELECT coalesce(sum(pay.amount) FILTER(WHERE pay.kind='RECEIPT'),0)::text AS received,
 coalesce(sum(pay.amount) FILTER(WHERE pay.kind='REFUND' AND pay.purpose IS DISTINCT FROM 'REVERSAL'),0)::text AS refunded,
 coalesce(sum(pay.amount) FILTER(WHERE pay.purpose='REVERSAL'),0)::text AS reversed FROM sarathi.payments pay
 LEFT JOIN sarathi.quotations q ON q.id=pay.quotation_id WHERE ($1::bigint IS NOT NULL AND pay.project_id=$1)
 OR ($1::bigint IS NULL AND pay.project_id IS NULL AND coalesce(q.root_quotation_id,q.id)=$2))
 SELECT b.id::text AS "baselineId",b.quote_number AS "baselineNumber",b.total::text,l.received,l.refunded,l.reversed
 FROM ledger l LEFT JOIN baseline b ON true`,
      [owned.projectId, owned.rootId]
    )
  ).rows[0];
  return {
    baselineId: row.baselineId,
    baselineNumber: row.baselineNumber,
    ...ledgerBalance(row.total, row.received, row.refunded, row.reversed)
  };
}
export async function savePayment(headers: Headers, input: PaymentInput, key: string) {
  const data = validatePayment(input);
  const { pool, actor } = await authorizedDatabase(
    headers,
    data.refundOfId ? "payments.refund" : "payments.create"
  );
  return recordPayment(pool, actor.id, input, key);
}
export async function findPaymentSubmission(headers: Headers, rawKey: string) {
  const { pool } = await authorizedDatabase(headers, "payments.read"),
    key = requestId(rawKey);
  return (
    (
      await pool.query<{ id: string }>(
        "SELECT id::text FROM sarathi.payments WHERE recorded_by=$1 AND creation_request_id=$2",
        [pool.actorId, key]
      )
    ).rows[0] ?? null
  );
}
export async function findAllocationSubmission(headers: Headers, rawKey: string) {
  const { pool } = await authorizedDatabase(headers, "payments.read"),
    key = requestId(rawKey);
  return (
    (
      await pool.query<{ id: string }>(
        "SELECT receipt_id::text AS id FROM sarathi.payment_allocations WHERE created_by=$1 AND request_id=$2",
        [pool.actorId, key]
      )
    ).rows[0] ?? null
  );
}
export async function saveAllocation(
  headers: Headers,
  receipt: string,
  quote: string,
  amount: string,
  key: string
) {
  const { pool } = await authorizedDatabase(headers, "payments.allocate");
  return allocatePayment(pool, receipt, quote, amount, key);
}
export async function paymentDetail(headers: Headers, rawId: string, rawAfter = "") {
  const { pool, context } = await authorizedDatabase(headers, "payments.read"),
    id = databaseId(rawId);
  const payment = await readPayment(pool, id),
    balance = await balanceFor(pool, payment);
  const after = rawAfter ? databaseId(rawAfter) : null;
  const events = (
    await pool.query<{
      id: string;
      event: string;
      amount: string;
      quotationId: string | null;
      paymentId: string;
      number: string | null;
      actor: string;
      at: string;
    }>(
      `
 SELECT e.id::text,e.event,e.amount::text,e.payment_id::text AS "paymentId",e.quotation_id::text AS "quotationId",q.quote_number AS number,u.display_name AS actor,
 e.recorded_at::text AS at FROM sarathi.payment_events e LEFT JOIN sarathi.quotations q ON q.id=e.quotation_id
 JOIN sarathi.users u ON u.id=e.recorded_by WHERE (e.payment_id=$1 OR EXISTS(SELECT 1 FROM sarathi.payments adjustment WHERE adjustment.id=e.payment_id AND adjustment.refund_of_id=$1)) AND ($2::bigint IS NULL OR e.id<$2) ORDER BY e.id DESC LIMIT 51`,
      [id, after]
    )
  ).rows;
  return {
    payment,
    balance,
    remaining: receiptRemaining(payment),
    permissions: context.permissions,
    events: events.slice(0, 50),
    next: events.length > 50 ? events[49].id : null
  };
}
export async function paymentPdf(headers: Headers, rawId: string) {
  const { pool } = await authorizedDatabase(headers, "payments.read");
  return (
    (
      await pool.query<{ pdf: Buffer; number: string }>(
        `SELECT d.pdf,p.receipt_number AS number FROM sarathi.payment_documents d JOIN sarathi.payments p ON p.id=d.payment_id WHERE d.payment_id=$1`,
        [databaseId(rawId)]
      )
    ).rows[0] ?? null
  );
}
export async function financialSummary(headers: Headers, kind: "project" | "quote", rawId: string) {
  const { pool, context } = await authorizedDatabase(headers, "payments.read"),
    id = databaseId(rawId);
  const targetRow = (
    await pool.query<Target & { status: string | null }>(
      kind === "project"
        ? `SELECT id::text AS "projectId",NULL::text AS "quotationId",customer_id::text AS "customerId",division_id::text AS "divisionId",NULL::text AS "rootId",NULL::text AS status FROM sarathi.projects WHERE id=$1`
        : `SELECT project_id::text AS "projectId",id::text AS "quotationId",customer_id::text AS "customerId",division_id::text AS "divisionId",coalesce(root_quotation_id,id)::text AS "rootId",status FROM sarathi.quotations WHERE id=$1`,
      [id]
    )
  ).rows[0];
  if (!targetRow) return null;
  const balance = await balanceFor(pool, targetRow);
  return {
    balance,
    canCreate: context.permissions.includes("payments.create"),
    projectId: targetRow.projectId,
    quotationId: targetRow.status === "APPROVED" ? targetRow.quotationId : null
  };
}
export async function paymentList(headers: Headers, input: ListQuery): Promise<ListPage<Payment>> {
  const { pool } = await authorizedDatabase(headers, "payments.read");
  const query = readListQuery(input);
  const filter = ` WHERE ($1='' OR concat_ws(' ',p.name,q.title,c.name,pay.receipt_number,pay.reference) ILIKE $1) AND ($2='' OR CASE WHEN pay.purpose='REVERSAL' THEN 'REVERSAL' ELSE pay.kind END=$2)`;
  const values = [
    query.q ? "%" + query.q.replace(/[\\%_]/g, (char) => "\\" + char) + "%" : "",
    query.status || ""
  ];
  const rows = (
    await pool.query<Payment>(
      paymentSelect +
        " " +
        paymentFrom +
        filter +
        " AND ($3::bigint IS NULL OR pay.id<$3) ORDER BY pay.id DESC LIMIT 51",
      [...values, query.after || null]
    )
  ).rows;
  const total = Number(
    (
      await pool.query<{ total: string }>(
        "SELECT count(*)::text AS total " + paymentFrom + filter,
        values
      )
    ).rows[0].total
  );
  if (!Number.isSafeInteger(total)) throw new Error("Payment count exceeds supported range.");
  return { items: rows.slice(0, 50), total, next: rows.length > 50 ? rows[49].id : null };
}
export interface PaymentTarget {
  id: string;
  label: string;
  projectId: string | null;
}
export async function paymentTargets(
  headers: Headers,
  search = "",
  selectedProject = "",
  selectedQuote = ""
) {
  const { pool, context } = await authorizedDatabase(headers, "payments.create");
  const text = boundedText(search, "Search", 100, false),
    pattern = "%" + text.replace(/[\\%_]/g, (char) => "\\" + char) + "%";
  const projectId = selectedProject ? databaseId(selectedProject) : null,
    quoteId = selectedQuote ? databaseId(selectedQuote) : null;
  const projects = (
    await pool.query<PaymentTarget>(
      `SELECT p.id::text,concat_ws(' · ',p.name,c.name,d.name) AS label,p.id::text AS "projectId"
 FROM sarathi.projects p JOIN sarathi.customers c ON c.id=p.customer_id JOIN sarathi.divisions d ON d.id=p.division_id
 WHERE ($1='' OR concat_ws(' ',p.name,c.name) ILIKE $2 OR p.id=$3 OR p.id=(SELECT project_id FROM sarathi.quotations WHERE id=$4)) ORDER BY (p.id=$3 OR p.id=(SELECT project_id FROM sarathi.quotations WHERE id=$4)) DESC NULLS LAST,p.id DESC LIMIT 30`,
      [text, pattern, projectId, quoteId]
    )
  ).rows;
  const quotations = (
    await pool.query<PaymentTarget>(
      `SELECT q.id::text,concat_ws(' · ',coalesce(q.quote_number,'Legacy quotation ' || q.id),q.title,q.customer_name,'INR ' || q.total::text) AS label,q.project_id::text AS "projectId"
 FROM sarathi.quotations q WHERE q.status='APPROVED' AND ($1='' OR concat_ws(' ',q.quote_number,q.title,q.customer_name) ILIKE $2 OR q.id=$3)
 ORDER BY (q.id=$3) DESC NULLS LAST,q.id DESC LIMIT 30`,
      [text, pattern, quoteId]
    )
  ).rows;
  return { projects, quotations, permissions: context.permissions };
}
