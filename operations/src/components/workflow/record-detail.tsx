import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/server/dal";
import { getWorkflowDetail } from "@/server/workflow";
import { projectFlow, stageInfo, type RecordLink, type WorkflowKind } from "@/lib/workflow";
import type { ProjectStatus } from "@/lib/operations";
import { LifecycleDiagram } from "./lifecycle-diagram";
import { StageTooltip } from "./stage-tooltip";
import { StepPanel } from "./step-panel";
import { ActivityTimeline } from "./activity-timeline";

export async function RecordDetail({ kind, id }: { kind: WorkflowKind; id: string }) {
  const requestHeaders = await headers();
  const actor = await getActor(requestHeaders);
  if (!actor) redirect("/admin/login");
  const detail = await getWorkflowDetail(requestHeaders, kind, id);
  if (!detail) notFound();
  const base = kind === "quote" ? "quotes" : `${kind}s`;
  const stage = stageInfo(kind, detail.status);
  const project = detail.related.find((link) => link.href.startsWith("/admin/projects/"));
  let action: RecordLink | undefined;
  if (kind === "quote" || (kind === "lead" && detail.status === "CONVERTED"))
    action = project ? { ...project, label: "Continue in linked project" } : undefined;
  else if (actor.role !== "VIEWER" && !detail.onHold)
    action = {
      label: kind === "lead" ? "Manage lead in list" : "Manage stage in project list",
      href: `/admin/${base}?q=${encodeURIComponent(detail.title)}`
    };
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <nav aria-label="Record breadcrumb" className="tw:mb-5 tw:text-sm">
          <Link href={`/admin/${base}`}>← All {base === "quotes" ? "quotations" : base}</Link>
        </nav>
        <section className="workspace-heading">
          <span className="eyebrow">
            {kind === "quote" ? "QUOTATION" : kind.toUpperCase()} #{detail.id}
          </span>
          <h1 className="tw:break-words">{detail.title}</h1>
          <p className="lead-copy">
            {detail.onHold ? "On hold · " : ""}
            {stage.label}
            <StageTooltip kind={kind} status={detail.status} />
          </p>
        </section>
        <LifecycleDiagram
          current={
            kind === "lead"
              ? detail.status === "CONVERTED"
                ? "setup"
                : "lead"
              : kind === "quote"
                ? "quote"
                : projectFlow(detail.status as ProjectStatus)
          }
        />
        <section className="workflow-panel" aria-label="Record details">
          <h2>At a glance</h2>
          <p>{stage.description}</p>
          <dl className="workflow-definition">
            {detail.fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value || "Not recorded"}</dd>
              </div>
            ))}
          </dl>
          <h3>Linked records</h3>
          {detail.related.length ? (
            <ul className="tw:space-y-2 tw:pl-5">
              {detail.related.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>No linked records yet.</p>
          )}
          {kind === "project" && (
            <p className="tw:text-sm tw:text-[var(--muted)]">
              Up to 10 latest linked quotations are shown. Quotation preparation and sending are not
              available in this workspace yet.
            </p>
          )}
        </section>
        <StepPanel
          kind={kind}
          status={detail.status}
          role={actor.role}
          action={action}
          onHold={detail.onHold}
          holdReason={detail.holdReason}
        />
        <ActivityTimeline events={detail.events} truncated={detail.historyTruncated} />
      </main>
    </div>
  );
}
