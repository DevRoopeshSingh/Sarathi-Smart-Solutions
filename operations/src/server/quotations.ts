import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { authorizedDatabase } from "./dal";
import { transaction } from "./transaction";
import type { TenantPool } from "./tenant-pool";
import { assertDivisionAccess } from "./tenancy";
import { databaseId, boundedText } from "./input";
import { InputError } from "./mutation-errors";
import {
  validateQuote,
  requestId,
  quoteVersion,
  documentSettings,
  assertTaxProfile,
  type QuoteDraftInput,
  type DocumentSettings
} from "./quotation-input";
import { calculateQuotation, type QuoteLine } from "../lib/quotation-money";
import type { Quotation, QuoteSnapshot } from "../lib/quotations";
import { requiresProjectTransitionReason, type ProjectStatus } from "../lib/operations";
import { renderQuotation, QUOTATION_RENDERER_VERSION } from "./documents/quotation";
const query = `SELECT q.id::text,q.customer_id::text AS "customerId",coalesce(q.division_id,p.division_id)::text AS "divisionId",
 d.name AS "divisionName",q.project_id::text AS "projectId",p.name AS "projectName",q.title,q.version,(SELECT max(v.version) FROM sarathi.quotations v WHERE coalesce(v.root_quotation_id,v.id)=coalesce(q.root_quotation_id,q.id)) AS "latestVersion",q.draft_version AS "draftVersion",q.status,
 q.quote_number AS "quotationNumber",coalesce(q.root_quotation_id,q.id)::text AS "rootId",q.revision_of::text AS "revisionOf",
 q.customer_name AS "customerName",q.customer_phone AS "customerPhone",q.customer_email AS "customerEmail",q.customer_address AS "customerAddress",
 q.site_address AS "siteAddress",q.subtotal::text,q.discount::text,q.tax_amount::text AS tax,q.total::text,q.tax_mode AS "taxMode",
 q.valid_until::text AS "validUntil",q.terms,(q.valid_until<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date) AS expired,
 EXISTS(SELECT 1 FROM sarathi.quotation_documents doc WHERE doc.quotation_id=q.id) AS "hasDocument"
 FROM sarathi.quotations q LEFT JOIN sarathi.projects p ON p.id=q.project_id
 JOIN sarathi.divisions d ON d.id=coalesce(q.division_id,p.division_id) WHERE q.id=$1`;
async function readQuote(
  db: Pick<PoolClient, "query"> | TenantPool,
  id: string,
  lock = false
): Promise<Quotation> {
  const row = (await db.query<Quotation>(query + (lock ? " FOR UPDATE OF q" : ""), [id])).rows[0];
  if (!row) throw new InputError("Quotation is unavailable or you do not have access.");
  row.items = (
    await db.query<QuoteLine>(
      `SELECT description,quantity::text,unit,unit_sell::text AS rate,tax_percent::text AS "taxPercent",
 line_amount::text AS amount,discount_amount::text AS discount,net_amount::text AS net,tax_amount::text AS tax,line_total::text AS total
 FROM sarathi.quotation_items WHERE quotation_id=$1 ORDER BY position`,
      [id]
    )
  ).rows;
  return row;
}
// Serialize a project first, then its quotation family. All lifecycle operations use this order.
async function lockQuote(client: PoolClient, id: string) {
  const before = await readQuote(client, id);
  if (before.projectId) {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('quote-project:' || $1,0))", [
      before.projectId
    ]);
    await client.query("SELECT id FROM sarathi.projects WHERE id=$1 FOR UPDATE", [
      before.projectId
    ]);
  }
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('quote-family:' || $1,0))", [
    before.rootId
  ]);
  return readQuote(client, id, true);
}
async function reason(client: PoolClient, value: string) {
  await client.query("SELECT set_config('sarathi.quote_reason',$1,true)", [value]);
}
async function profile(
  client: PoolClient,
  divisionId: string
): Promise<{ name: string; settings: DocumentSettings }> {
  const row = (
    await client.query<{ name: string; settings: unknown }>(
      `SELECT concat_ws(' ',o.name,d.name) AS name,d.document_settings AS settings
 FROM sarathi.divisions d JOIN sarathi.organizations o ON o.id=d.organization_id WHERE d.id=$1`,
      [divisionId]
    )
  ).rows[0];
  if (!row) throw new InputError("Division is unavailable.");
  return {
    name: boundedText(row.name, "Division business name", 200),
    settings: documentSettings(row.settings)
  };
}
async function customer(client: PoolClient, id: string) {
  const row = (
    await client.query<{
      name: string;
      phone: string;
      email: string | null;
      address: string | null;
    }>("SELECT name,phone,email,address FROM sarathi.customers WHERE id=$1", [id])
  ).rows[0];
  if (!row) throw new InputError("Select an authorized customer.");
  return row;
}
async function ownedProject(
  client: PoolClient,
  id: string | null,
  customerId: string,
  divisionId: string
) {
  if (!id) return;
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('quote-project:' || $1,0))", [
    id
  ]);
  const row = (
    await client.query<{ customer: string; division: string }>(
      "SELECT customer_id::text AS customer,division_id::text AS division FROM sarathi.projects WHERE id=$1",
      [id]
    )
  ).rows[0];
  if (!row || row.customer !== customerId || row.division !== divisionId)
    throw new InputError("The project must belong to this customer and division.");
}
async function replaceItems(client: PoolClient, id: string, items: QuoteLine[]) {
  await client.query("DELETE FROM sarathi.quotation_items WHERE quotation_id=$1", [id]);
  for (const [index, item] of items.entries())
    await client.query(
      `INSERT INTO sarathi.quotation_items
 (quotation_id,position,description,unit,quantity,unit_sell,tax_percent,line_amount,discount_amount,net_amount,tax_amount,line_total)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        index + 1,
        item.description,
        item.unit,
        item.quantity,
        item.rate,
        item.taxPercent,
        item.amount,
        item.discount,
        item.net,
        item.tax,
        item.total
      ]
    );
}
type ValidQuote = ReturnType<typeof validateQuote>;
async function insertDraft(
  client: PoolClient,
  actorId: string,
  data: ValidQuote,
  key: string,
  hash: string,
  parent?: Quotation
) {
  await ownedProject(client, data.projectId, data.customerId, data.divisionId);
  const c = await customer(client, data.customerId);
  const identity = await profile(client, data.divisionId);
  assertTaxProfile(data.taxMode, data.items, identity.settings);
  const version =
    parent || data.projectId
      ? (
          await client.query<{ version: number }>(
            `SELECT coalesce(max(version),0)+1 AS version FROM sarathi.quotations
 WHERE ($1::bigint IS NOT NULL AND project_id=$1) OR ($2::bigint IS NOT NULL AND coalesce(root_quotation_id,id)=$2)`,
            [data.projectId, parent?.rootId ?? null]
          )
        ).rows[0].version
      : 1;
  const q = (
    await client.query<{ id: string }>(
      `INSERT INTO sarathi.quotations
 (customer_id,division_id,project_id,title,version,created_by,customer_name,customer_phone,customer_email,customer_address,site_address,
 subtotal,discount,tax_amount,total,recommended_advance,terms,valid_until,tax_mode,root_quotation_id,revision_of,creation_request_id,creation_request_hash)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,0,$16,$17,$18,$19,$20,$21,$22) RETURNING id::text`,
      [
        data.customerId,
        data.divisionId,
        data.projectId,
        data.title,
        version,
        actorId,
        c.name,
        c.phone,
        c.email,
        c.address,
        data.siteAddress,
        data.totals.subtotal,
        data.totals.discount,
        data.totals.tax,
        data.totals.total,
        data.terms,
        data.validUntil,
        data.taxMode,
        parent?.rootId ?? null,
        parent?.id ?? null,
        key,
        hash
      ]
    )
  ).rows[0];
  await replaceItems(client, q.id, data.totals.items);
  return q;
}
async function retry(client: PoolClient, actorId: string, key: string, hash: string) {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('quote-request:' || $1 || ':' || $2,0))",
    [actorId, key]
  );
  const existing = (
    await client.query<{ id: string; hash: string }>(
      "SELECT id::text,creation_request_hash AS hash FROM sarathi.quotations WHERE created_by=$1 AND creation_request_id=$2",
      [actorId, key]
    )
  ).rows[0];
  if (existing && existing.hash !== hash)
    throw new InputError(
      "This submission was already saved with different details. Open the saved quotation before retrying."
    );
  return existing;
}
// Internal persistence API: pool/actor originate from authenticated DAL only; tests use isolated runtime credentials.
export async function createDraft(
  pool: TenantPool,
  actorId: string,
  input: QuoteDraftInput,
  rawKey: string
) {
  const data = validateQuote(input),
    key = requestId(rawKey),
    hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return transaction(pool, async (client) => {
    const existing = await retry(client, actorId, key, hash);
    if (existing) return { id: existing.id };
    return insertDraft(client, actorId, data, key, hash);
  });
}
export async function editDraft(
  pool: TenantPool,
  input: QuoteDraftInput,
  rawId: string,
  rawVersion: string
) {
  const data = validateQuote(input),
    id = databaseId(rawId),
    version = quoteVersion(rawVersion);
  return transaction(pool, async (client) => {
    const q = await lockQuote(client, id);
    if (q.status !== "DRAFT" || q.taxMode === "LEGACY")
      throw new InputError(
        "Only current drafts can be edited. Create a revision of an issued quotation."
      );
    if (q.draftVersion !== version)
      throw new InputError("This draft changed since you opened it. Reload before saving.");
    if (
      q.customerId !== data.customerId ||
      q.divisionId !== data.divisionId ||
      q.projectId !== data.projectId
    )
      throw new InputError(
        "Customer, division and project are fixed for this draft. Create a new quotation to change them."
      );
    const c = await customer(client, data.customerId),
      identity = await profile(client, data.divisionId);
    assertTaxProfile(data.taxMode, data.items, identity.settings);
    await replaceItems(client, id, data.totals.items);
    await client.query(
      `UPDATE sarathi.quotations SET title=$2,site_address=$3,subtotal=$4,discount=$5,tax_amount=$6,total=$7,
 terms=$8,valid_until=$9,tax_mode=$10,customer_name=$11,customer_phone=$12,customer_email=$13,customer_address=$14,draft_version=draft_version+1 WHERE id=$1`,
      [
        id,
        data.title,
        data.siteAddress,
        data.totals.subtotal,
        data.totals.discount,
        data.totals.tax,
        data.totals.total,
        data.terms,
        data.validUntil,
        data.taxMode,
        c.name,
        c.phone,
        c.email,
        c.address
      ]
    );
    return { id };
  });
}
export async function reviseQuote(
  pool: TenantPool,
  actorId: string,
  rawId: string,
  rawKey: string
) {
  const id = databaseId(rawId),
    key = requestId(rawKey),
    hash = createHash("sha256")
      .update("revision:" + id)
      .digest("hex");
  return transaction(pool, async (client) => {
    const existing = await retry(client, actorId, key, hash);
    if (existing) return { id: existing.id };
    const q = await lockQuote(client, id);
    if (!["SENT", "APPROVED", "DECLINED"].includes(q.status))
      throw new InputError("Revise the latest issued, accepted or rejected version.");
    if (q.taxMode === "LEGACY")
      throw new InputError(
        "Historic quotations require owner reconciliation of their original line items and tax treatment before revision. Their original records remain available."
      );
    const latest = (
      await client.query<{ version: number }>(
        "SELECT max(version) AS version FROM sarathi.quotations WHERE coalesce(root_quotation_id,id)=$1",
        [q.rootId]
      )
    ).rows[0].version;
    if (q.version !== latest)
      throw new InputError("Revise the latest version from the version history.");
    const pending = (
      await client.query<{ id: string }>(
        "SELECT id::text FROM sarathi.quotations WHERE coalesce(root_quotation_id,id)=$1 AND status='DRAFT' ORDER BY version DESC LIMIT 1",
        [q.rootId]
      )
    ).rows[0];
    if (pending)
      throw new InputError("A revision draft already exists. Open it from the version history.");
    const data = validateQuote({
      customerId: q.customerId,
      divisionId: q.divisionId,
      projectId: q.projectId ?? undefined,
      title: q.title,
      siteAddress: q.siteAddress,
      discount: q.discount,
      taxMode: q.taxMode,
      validUntil: q.validUntil,
      terms: q.terms,
      items: q.items
    });
    await reason(client, "Revision of " + (q.quotationNumber ?? "v" + q.version));
    return insertDraft(client, actorId, data, key, hash, q);
  });
}
export async function issueQuote(
  pool: TenantPool,
  actorId: string,
  rawId: string,
  rawVersion: string,
  renderer = renderQuotation
) {
  const id = databaseId(rawId),
    version = quoteVersion(rawVersion);
  return transaction(pool, async (client) => {
    const q = await lockQuote(client, id);
    if (q.hasDocument && q.status !== "DRAFT") return { id };
    if (q.status !== "DRAFT" || q.taxMode === "LEGACY")
      throw new InputError("Only a current draft can be issued.");
    if (q.draftVersion !== version)
      throw new InputError(
        "This draft changed. Reload and review the saved totals before issuing."
      );
    if (q.expired) throw new InputError("Update the validity date before issuing this quotation.");
    const latest = (
      await client.query<{ version: number }>(
        "SELECT max(version) AS version FROM sarathi.quotations WHERE coalesce(root_quotation_id,id)=$1",
        [q.rootId]
      )
    ).rows[0].version;
    if (q.version !== latest) throw new InputError("Only the latest version can be issued.");
    const identity = await profile(client, q.divisionId);
    assertTaxProfile(q.taxMode, q.items, identity.settings);
    const totals = calculateQuotation(q.items, q.discount, q.taxMode);
    if (
      totals.subtotal !== q.subtotal ||
      totals.tax !== q.tax ||
      totals.total !== q.total ||
      JSON.stringify(totals.items) !== JSON.stringify(q.items)
    ) {
      // SQL quantity normalization may differ; monetary fields must still match exactly.
      if (
        totals.items.some((item, i) =>
          ["amount", "discount", "net", "tax", "total"].some(
            (field) => item[field as keyof QuoteLine] !== q.items[i]?.[field as keyof QuoteLine]
          )
        ) ||
        totals.subtotal !== q.subtotal ||
        totals.tax !== q.tax ||
        totals.total !== q.total
      )
        throw new InputError("Saved line totals are inconsistent. Re-save and review the draft.");
    }
    const stamp = (
      await client.query<{ at: string; day: string }>(
        `SELECT CURRENT_TIMESTAMP::text AS at,to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS day`
      )
    ).rows[0];
    const previous = q.revisionOf ? await readQuote(client, q.revisionOf, true) : null;
    const base =
      previous?.quotationNumber?.replace(/\/R[0-9]+$/, "") ??
      (
        await client.query<{ number: string }>(
          "SELECT sarathi.next_quotation_number($1) AS number",
          [q.divisionId]
        )
      ).rows[0].number;
    const quotationNumber = base + "/R" + q.version;
    const snapshot: QuoteSnapshot = {
      schemaVersion: 1,
      quotationNumber,
      version: q.version,
      issuedAt: stamp.day,
      validUntil: q.validUntil,
      title: q.title,
      currency: "INR",
      business: {
        name: identity.settings.legalName || identity.name,
        address: identity.settings.address,
        phone: identity.settings.phone,
        email: identity.settings.email,
        gstin: q.taxMode !== "NONE" ? identity.settings.gstin : undefined
      },
      customer: {
        name: q.customerName,
        phone: q.customerPhone,
        email: q.customerEmail,
        address: q.customerAddress
      },
      siteAddress: q.siteAddress,
      taxMode: q.taxMode,
      items: totals.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      net: totals.net,
      total: totals.total,
      terms: q.terms
    };
    const pdf = await renderer(snapshot),
      hash = createHash("sha256").update(pdf).digest("hex");
    await client.query(
      "INSERT INTO sarathi.quotation_documents(quotation_id,snapshot,pdf,sha256,renderer_version,created_by) VALUES($1,$2,$3,$4,$5,$6)",
      [id, snapshot, pdf, hash, QUOTATION_RENDERER_VERSION, actorId]
    );
    if (previous && ["SENT", "DECLINED"].includes(previous.status)) {
      await reason(client, "Replaced by issued revision " + quotationNumber);
      await client.query(
        "UPDATE sarathi.quotations SET status='SUPERSEDED',updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [previous.id]
      );
    }
    await reason(client, "Issued immutable document " + quotationNumber);
    await client.query(
      "UPDATE sarathi.quotations SET status='SENT',quote_number=$2,frozen_at=$3,sent_at=$3,updated_at=$3 WHERE id=$1",
      [id, quotationNumber, stamp.at]
    );
    return { id };
  });
}
export interface StaffDecision {
  reason: string;
  acknowledge: boolean;
  advanceProject?: boolean;
  stageReason?: string;
}
export async function decideQuote(
  pool: TenantPool,
  actorId: string,
  rawId: string,
  accept: boolean,
  input: StaffDecision
) {
  const id = databaseId(rawId),
    evidence = boundedText(input?.reason, "Decision / customer communication reference", 1000);
  if (
    input?.acknowledge !== true ||
    typeof accept !== "boolean" ||
    (input.advanceProject !== undefined && typeof input.advanceProject !== "boolean")
  )
    throw new InputError(
      "Confirm that this is a staff record of customer communication, not a digital signature."
    );
  const stageReason = boundedText(input.stageReason ?? "", "Project stage reason", 1000, false);
  return transaction(pool, async (client) => {
    const q = await lockQuote(client, id),
      status = accept ? "APPROVED" : "DECLINED";
    if (q.status === status) return { id };
    if (q.status !== "SENT")
      throw new InputError("Only an issued quotation can receive a decision.");
    if (accept && q.expired)
      throw new InputError(
        "This quotation has expired. Issue a revised quotation before recording acceptance."
      );
    const pending = (
      await client.query(
        "SELECT 1 FROM sarathi.quotations WHERE coalesce(root_quotation_id,id)=$1 AND version>$2 AND status IN('SENT','APPROVED')",
        [q.rootId, q.version]
      )
    ).rowCount;
    if (accept && pending)
      throw new InputError("Record acceptance against the latest issued revision.");
    if (accept) {
      const current = (
        await client.query<{ id: string; root: string }>(
          `SELECT id::text,coalesce(root_quotation_id,id)::text AS root FROM sarathi.quotations
 WHERE status='APPROVED' AND (($1::bigint IS NOT NULL AND project_id=$1) OR coalesce(root_quotation_id,id)=$2) FOR UPDATE`,
          [q.projectId, q.rootId]
        )
      ).rows;
      if (current.some((row) => row.root !== q.rootId))
        throw new InputError(
          "This project already has an accepted baseline from another quotation. Review that baseline before changing commercial terms."
        );
      for (const old of current) {
        await reason(
          client,
          "Accepted revision " + q.quotationNumber + " replaces this baseline. " + evidence
        );
        await client.query(
          "UPDATE sarathi.quotations SET status='SUPERSEDED',updated_at=CURRENT_TIMESTAMP WHERE id=$1",
          [old.id]
        );
      }
      if (input.advanceProject) {
        if (!q.projectId)
          throw new InputError(
            "This is a standalone quotation. Link a project when creating the quotation if project progression is needed."
          );
        const project = (
          await client.query<{ status: ProjectStatus; onHold: boolean }>(
            'SELECT operational_status AS status,on_hold AS "onHold" FROM sarathi.projects WHERE id=$1 FOR UPDATE',
            [q.projectId]
          )
        ).rows[0];
        if (project.onHold)
          throw new InputError("Release the project hold before progressing its stage.");
        if (
          !["SURVEY_PENDING", "SURVEY_COMPLETE", "COSTING", "PROCUREMENT"].includes(project.status)
        )
          throw new InputError(
            "The project is already beyond procurement or closed. Record acceptance without changing its stage."
          );
        if (project.status !== "PROCUREMENT") {
          if (requiresProjectTransitionReason(project.status, "PROCUREMENT") && !stageReason)
            throw new InputError("Provide a reason to skip a project stage.");
          await client.query(
            "UPDATE sarathi.projects SET operational_status='PROCUREMENT',updated_at=CURRENT_TIMESTAMP WHERE id=$1",
            [q.projectId]
          );
          await client.query(
            `INSERT INTO sarathi.status_history(project_id,from_status,to_status,was_on_hold,is_on_hold,reason,changed_by)
 VALUES($1,$2,'PROCUREMENT',false,false,$3,$4)`,
            [
              q.projectId,
              project.status,
              "Accepted quotation " + q.quotationNumber + ". " + stageReason,
              actorId
            ]
          );
        }
      }
    }
    await reason(
      client,
      "Staff-recorded customer " + (accept ? "acceptance: " : "rejection: ") + evidence
    );
    await client.query(
      "UPDATE sarathi.quotations SET status=$2," +
        (accept ? "approved_at" : "declined_at") +
        "=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1",
      [id, status]
    );
    return { id };
  });
}
export async function quotationDetail(
  headers: Headers,
  rawId: string,
  after?: string,
  versionsAfter?: string
) {
  const { pool, context } = await authorizedDatabase(headers, "quotations.read");
  let id: string;
  try {
    id = databaseId(rawId);
  } catch {
    return null;
  }
  let quote: Quotation;
  try {
    quote = await readQuote(pool, id);
  } catch (error) {
    if (error instanceof InputError) return null;
    throw error;
  }
  let cursor: string | null = null;
  let versionCursor: number | null = null;
  try {
    if (after) cursor = databaseId(after);
  } catch {
    cursor = null;
  }
  try {
    if (versionsAfter) versionCursor = quoteVersion(versionsAfter);
  } catch {
    versionCursor = null;
  }
  const [events, versions] = await Promise.all([
    pool.query<{
      id: string;
      event: string;
      reason: string | null;
      actor: string | null;
      at: string;
    }>(
      `SELECT e.id::text,e.event,e.reason,u.display_name AS actor,
 to_char(e.recorded_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI') AS at FROM sarathi.quotation_events e
 LEFT JOIN sarathi.users u ON u.id=e.recorded_by WHERE quotation_id=$1 AND ($2::bigint IS NULL OR e.id<$2) ORDER BY e.id DESC LIMIT 26`,
      [id, cursor]
    ),
    pool.query<{ id: string; version: number; status: string }>(
      "SELECT id::text,version,status FROM sarathi.quotations WHERE coalesce(root_quotation_id,id)=$1 AND ($2::integer IS NULL OR version<$2) ORDER BY version DESC LIMIT 26",
      [quote.rootId, versionCursor]
    )
  ]);
  return {
    quote,
    canEdit: context.permissions.includes("quotations.update"),
    canCreate: context.permissions.includes("quotations.create"),
    events: events.rows.slice(0, 25),
    next: events.rows.length > 25 ? events.rows[24].id : null,
    versions: versions.rows.slice(0, 25),
    versionsNext: versions.rows.length > 25 ? versions.rows[24].version : null
  };
}
export async function quotationEditorData(headers: Headers, id?: string) {
  const { pool, context } = await authorizedDatabase(
    headers,
    id ? "quotations.update" : "quotations.create"
  );
  const quote = id ? await readQuote(pool, databaseId(id)) : null;
  if (quote && (quote.status !== "DRAFT" || quote.taxMode === "LEGACY"))
    throw new InputError("Only current drafts can be edited.");
  const divisions = (
    await pool.query<{ id: string; name: string; settings: DocumentSettings }>(
      "SELECT id::text,name,document_settings AS settings FROM sarathi.divisions WHERE id=ANY($1::bigint[]) ORDER BY id",
      [context.divisions.map((d) => d.id)]
    )
  ).rows.map((d) => ({ ...d, settings: documentSettings(d.settings) }));
  const customers = (
    await pool.query<{ id: string; name: string; phone: string }>(
      "SELECT id::text,name,phone FROM sarathi.customers WHERE ($1::bigint IS NULL OR id=$1) ORDER BY id DESC LIMIT 25",
      [quote?.customerId ?? null]
    )
  ).rows;
  return { quote, divisions, customers };
}
export async function quotationProjects(
  headers: Headers,
  customerId: string,
  divisionId: string,
  search = ""
) {
  const { pool, context } = await authorizedDatabase(headers, "quotations.read");
  assertDivisionAccess(context, divisionId);
  const q = boundedText(search, "Project search", 100, false).replace(
    /[\\%_]/g,
    (char) => "\\" + char
  );
  return (
    await pool.query<{ id: string; name: string }>(
      "SELECT id::text,name FROM sarathi.projects WHERE customer_id=$1 AND division_id=$2 AND ($3='' OR name ILIKE $3) ORDER BY id DESC LIMIT 25",
      [databaseId(customerId), databaseId(divisionId), q ? "%" + q + "%" : ""]
    )
  ).rows;
}
export async function saveQuotation(
  headers: Headers,
  input: QuoteDraftInput,
  key: string,
  id?: string,
  version?: string
) {
  const { actor, pool, context } = await authorizedDatabase(
    headers,
    id ? "quotations.update" : "quotations.create"
  );
  assertDivisionAccess(context, input.divisionId);
  return id ? editDraft(pool, input, id, version ?? "") : createDraft(pool, actor.id, input, key);
}
export async function previewQuotation(headers: Headers, input: QuoteDraftInput) {
  const { pool, context } = await authorizedDatabase(headers, "quotations.create");
  const data = validateQuote(input);
  assertDivisionAccess(context, data.divisionId);
  return transaction(pool, async (client) => {
    const identity = await profile(client, data.divisionId);
    assertTaxProfile(data.taxMode, data.items, identity.settings);
    return data.totals;
  });
}
export async function issueQuotation(headers: Headers, id: string, version: string) {
  const { actor, pool } = await authorizedDatabase(headers, "quotations.update");
  return issueQuote(pool, actor.id, id, version);
}
export async function reviseQuotation(headers: Headers, id: string, key: string) {
  const { actor, pool } = await authorizedDatabase(headers, "quotations.create");
  return reviseQuote(pool, actor.id, id, key);
}
export async function decideQuotation(
  headers: Headers,
  id: string,
  accept: boolean,
  input: StaffDecision
) {
  const { actor, pool } = await authorizedDatabase(headers, "quotations.update");
  return decideQuote(pool, actor.id, id, accept, input);
}
export async function quotationPdf(headers: Headers, rawId: string) {
  const { pool } = await authorizedDatabase(headers, "quotations.read");
  return (
    (
      await pool.query<{ pdf: Buffer; sha256: string; number: string }>(
        "SELECT d.pdf,d.sha256,q.quote_number AS number FROM sarathi.quotation_documents d JOIN sarathi.quotations q ON q.id=d.quotation_id WHERE q.id=$1",
        [databaseId(rawId)]
      )
    ).rows[0] ?? null
  );
}
