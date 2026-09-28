import Link from "next/link";
import { ROLE_GUIDANCE, stageInfo, type RecordLink, type WorkflowKind } from "@/lib/workflow";
import type { UserRole } from "@/lib/operations";

export function StepPanel({
  kind,
  status,
  role,
  action,
  onHold = false,
  holdReason
}: {
  kind: WorkflowKind;
  status: string;
  role: UserRole;
  action?: RecordLink;
  onHold?: boolean;
  holdReason?: string | null;
}) {
  const stage = stageInfo(kind, status);
  return (
    <section className="workflow-panel" aria-label="Previous and next steps">
      <h2>What happens next?</h2>
      <p className="tw:text-sm tw:text-[var(--muted)]">{ROLE_GUIDANCE[role]}</p>
      <div className="tw:grid tw:gap-5 tw:md:grid-cols-2">
        <div>
          <h3>Usual previous step</h3>
          <p>{stage.previous}</p>
          <p className="tw:text-xs tw:text-[var(--muted)]">
            This is guidance, not proof of completion. Check recorded activity below for this
            record’s actual history.
          </p>
        </div>
        <div>
          <h3>{onHold ? "On hold — pause progression" : "Suggested next step"}</h3>
          <p>
            {onHold
              ? `Stage changes are paused. ${holdReason || "Ask the team about the hold."} Hold release is not available in this workspace yet; ask an administrator to arrange it.`
              : stage.next}
          </p>
          {action && (
            <Link className="admin-btn admin-btn-secondary" href={action.href}>
              {action.label}
            </Link>
          )}
        </div>
      </div>
      {kind === "project" && (
        <p className="tw:text-sm tw:text-[var(--muted)]">
          Skipping, reversing, cancelling or reopening a stage needs a recorded reason. A stage
          change does not automatically approve a quotation or record a payment.
        </p>
      )}
    </section>
  );
}
