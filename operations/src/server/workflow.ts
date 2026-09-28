import "server-only";
import { requirePermission } from "./dal";
import { getPool } from "./db";
import { databaseId } from "./input";
import {
  stageInfo,
  type ActivityEvent,
  type WorkflowDetail,
  type WorkflowKind
} from "../lib/workflow";

type RecordRow = {
  id: string;
  title: string;
  status: string;
  leadId: string | null;
  projectId: string | null;
  phone?: string;
  service?: string;
  source?: string;
  notes?: string | null;
  customer?: string;
  address?: string;
  scope?: string;
  version?: number;
  total?: string;
  subtotal?: string;
  serviceCharges?: string;
  discount?: string;
  tax?: string;
  terms?: string;
  onHold?: boolean;
  holdReason?: string | null;
};
type EventRow = {
  id: string;
  at: string;
  event: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  actor: string | null;
  wasOnHold: boolean | null;
  isOnHold: boolean | null;
  version: number | null;
};
const permissions = {
  lead: "leads.read",
  project: "projects.read",
  quote: "quotations.read"
} as const;

// Each public reader authorizes independently; list/page visibility is not a guard.
export async function getWorkflowDetail(
  headers: Headers,
  kind: WorkflowKind,
  rawId: string
): Promise<WorkflowDetail | null> {
  await requirePermission(headers, permissions[kind]);
  let id: string;
  try {
    id = databaseId(rawId);
  } catch {
    return null;
  }
  const pool = getPool();
  let row: RecordRow | undefined;
  if (kind === "lead") {
    row = (
      await pool.query<RecordRow>(
        `SELECT l.id::text, l.contact_name AS title, l.status,
      l.id::text AS "leadId", (SELECT p.id::text FROM sarathi.projects p WHERE p.lead_id=l.id ORDER BY p.id LIMIT 1) AS "projectId",
      l.phone, l.service_requested AS service, l.source, l.notes FROM sarathi.leads l WHERE l.id=$1`,
        [id]
      )
    ).rows[0];
  } else if (kind === "project") {
    row = (
      await pool.query<RecordRow>(
        `SELECT p.id::text, p.name AS title, p.operational_status AS status,
      p.lead_id::text AS "leadId", p.id::text AS "projectId", c.name AS customer, p.site_address AS address,
      p.scope, p.on_hold AS "onHold", p.hold_reason AS "holdReason"
      FROM sarathi.projects p JOIN sarathi.customers c ON c.id=p.customer_id WHERE p.id=$1`,
        [id]
      )
    ).rows[0];
  } else {
    row = (
      await pool.query<RecordRow>(
        `SELECT q.id::text, p.name AS title, q.status, p.lead_id::text AS "leadId",
      q.project_id::text AS "projectId", q.customer_name AS customer, q.site_address AS address, q.version,
      q.subtotal::text, q.service_charges::text AS "serviceCharges", q.discount::text, q.tax_amount::text AS tax,
      q.total::text, q.terms FROM sarathi.quotations q JOIN sarathi.projects p ON p.id=q.project_id WHERE q.id=$1`,
        [id]
      )
    ).rows[0];
  }
  if (!row) return null;
  const [activity, quotations] = await Promise.all([
    pool.query<EventRow>(
      `SELECT id, to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at,
      event, "fromStatus", "toStatus", reason, actor, "wasOnHold", "isOnHold", version
      FROM (
        SELECT 'lead-' || l.id AS id, l.created_at AS at, 'lead' AS event,
          NULL::text AS "fromStatus", NULL::text AS "toStatus", NULL::text AS reason, NULL::text AS actor,
          NULL::boolean AS "wasOnHold", NULL::boolean AS "isOnHold", NULL::int AS version
        FROM sarathi.leads l WHERE l.id=$1::bigint
        UNION ALL
        SELECT 'project-' || p.id, p.created_at, 'project', NULL, NULL, NULL, NULL, NULL, NULL, NULL
        FROM sarathi.projects p WHERE p.id=$2::bigint
        UNION ALL
        SELECT 'stage-' || h.id, h.changed_at, 'stage', h.from_status, h.to_status, h.reason, u.display_name,
          h.was_on_hold, h.is_on_hold, NULL
        FROM sarathi.status_history h JOIN sarathi.users u ON u.id=h.changed_by
        WHERE h.project_id=$2::bigint AND h.from_status IS NOT NULL
        UNION ALL
        SELECT 'quote-' || q.id || '-' || e.event, e.at, e.event, NULL, NULL, NULL,
          CASE WHEN e.event='quote-created' THEN u.display_name ELSE NULL END, NULL, NULL, q.version
        FROM sarathi.quotations q JOIN sarathi.users u ON u.id=q.created_by
        CROSS JOIN LATERAL (VALUES ('quote-created',q.created_at),('quote-sent',q.sent_at),
          ('quote-approved',q.approved_at),('quote-declined',q.declined_at),('quote-void',q.voided_at)) e(event,at)
        WHERE q.project_id=$2::bigint AND ($3::bigint IS NULL OR q.id=$3) AND e.at IS NOT NULL
      ) events ORDER BY at DESC, id DESC LIMIT 51`,
      [row.leadId, row.projectId, kind === "quote" ? row.id : null]
    ),
    pool.query<{ id: string; version: number; status: string }>(
      `SELECT id::text, version, status FROM sarathi.quotations
      WHERE project_id=$1::bigint ORDER BY version DESC LIMIT 10`,
      [row.projectId]
    )
  ]);
  const related = [];
  if (row.leadId && kind !== "lead")
    related.push({ label: "Original lead", href: `/admin/leads/${row.leadId}` });
  if (row.projectId && kind !== "project")
    related.push({ label: "Linked project", href: `/admin/projects/${row.projectId}` });
  for (const quote of quotations.rows)
    if (!(kind === "quote" && quote.id === row.id))
      related.push({
        label: `Quotation v${quote.version} · ${stageInfo("quote", quote.status).label}`,
        href: `/admin/quotes/${quote.id}`
      });
  const fields =
    kind === "lead"
      ? [
          { label: "Phone", value: row.phone ?? null },
          { label: "Service requested", value: row.service ?? null },
          { label: "Source", value: row.source ?? null },
          { label: "Notes", value: row.notes ?? null }
        ]
      : kind === "project"
        ? [
            { label: "Customer", value: row.customer ?? null },
            { label: "Site address", value: row.address ?? null },
            { label: "Scope", value: row.scope ?? null }
          ]
        : [
            { label: "Customer on quotation", value: row.customer ?? null },
            { label: "Site address", value: row.address ?? null },
            { label: "Subtotal", value: `₹${row.subtotal}` },
            { label: "Service charges", value: `₹${row.serviceCharges}` },
            { label: "Discount", value: `₹${row.discount}` },
            { label: "Tax", value: `₹${row.tax}` },
            { label: "Total (INR)", value: `₹${row.total}` },
            { label: "Terms", value: row.terms ?? null }
          ];
  return {
    id,
    kind,
    title: kind === "quote" ? `${row.title} · Quotation v${row.version}` : row.title,
    status: row.status,
    fields,
    related,
    onHold: row.onHold,
    holdReason: row.holdReason,
    events: activity.rows.slice(0, 50).map(activityEvent),
    historyTruncated: activity.rows.length > 50
  };
}

function activityEvent(row: EventRow): ActivityEvent {
  const quoteEvents: Record<string, string> = {
    "quote-created": "created",
    "quote-sent": "sent",
    "quote-approved": "approved",
    "quote-declined": "declined",
    "quote-void": "voided"
  };
  let title = row.event === "lead" ? "Lead captured" : "Project created";
  if (row.event === "stage") {
    title =
      row.wasOnHold !== row.isOnHold
        ? row.isOnHold
          ? "Project placed on hold"
          : "Project hold released"
        : `${stageInfo("project", row.fromStatus ?? "").label} → ${stageInfo("project", row.toStatus ?? "").label}`;
  } else if (row.event.startsWith("quote-"))
    title = `Quotation v${row.version} ${quoteEvents[row.event]}`;
  return { id: row.id, at: row.at, title, description: row.reason, actor: row.actor };
}

export async function hasCompletedOnboarding(headers: Headers): Promise<boolean> {
  const actor = await requirePermission(headers, "dashboard.read");
  const result = await getPool().query<{ completed: boolean }>(
    "SELECT onboarding_completed_at IS NOT NULL AS completed FROM sarathi.users WHERE id=$1 AND active",
    [actor.id]
  );
  return result.rows[0]?.completed ?? false;
}

export async function completeOnboarding(headers: Headers): Promise<void> {
  const actor = await requirePermission(headers, "dashboard.read");
  const result = await getPool().query(
    "UPDATE sarathi.users SET onboarding_completed_at=COALESCE(onboarding_completed_at,now()) WHERE id=$1 AND active",
    [actor.id]
  );
  if (result.rowCount !== 1) throw new Error("Unable to acknowledge onboarding.");
}
