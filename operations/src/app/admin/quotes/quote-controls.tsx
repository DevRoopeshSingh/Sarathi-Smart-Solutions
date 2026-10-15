"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Quotation, QuoteResult } from "@/lib/quotations";
import { issueQuoteAction, reviseQuoteAction, decisionQuoteAction } from "./actions";
export function QuoteControls({
  quote,
  canEdit,
  canCreate
}: {
  quote: Quotation;
  canEdit: boolean;
  canCreate: boolean;
}) {
  const router = useRouter(),
    busy = useRef(false),
    key = useRef<string | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [acknowledge, setAck] = useState(false),
    [reason, setReason] = useState(""),
    [advance, setAdvance] = useState(false),
    [stageReason, setStageReason] = useState("");
  const run = async (work: () => Promise<QuoteResult>, revision = false) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await work();
      if ("error" in result) setError(result.error);
      else {
        if (revision) router.push("/admin/quotes/" + result.id + "/edit");
        router.refresh();
      }
    } catch {
      setError("The response was interrupted. Retry the action to check its saved state.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <section className="workflow-panel quote-controls" aria-label="Quotation actions">
      <h2>Quotation actions</h2>
      {quote.hasDocument ? (
        <a className="admin-btn" href={"/api/admin/quotations/" + quote.id + "/pdf"} download>
          Download issued PDF
        </a>
      ) : (
        quote.status !== "DRAFT" && (
          <p>
            The original PDF was not stored for this historical record. Contact the owner before
            preparing a revised document.
          </p>
        )
      )}
      {canEdit && quote.status === "DRAFT" && quote.taxMode !== "LEGACY" && (
        <>
          <p>
            <Link href={"/admin/quotes/" + quote.id + "/edit"}>Edit draft</Link>
          </p>
          <label>
            <input
              type="checkbox"
              checked={reviewed}
              disabled={pending}
              onChange={(event) => setReviewed(event.target.checked)}
            />{" "}
            I have reviewed the saved items, totals, customer and terms. Issuing fixes this version.
          </label>
          <button
            className="admin-btn"
            disabled={pending || !reviewed}
            onClick={() => void run(() => issueQuoteAction(quote.id, String(quote.draftVersion)))}
          >
            Issue quotation
          </button>
        </>
      )}
      {canCreate &&
        ["SENT", "APPROVED", "DECLINED"].includes(quote.status) &&
        quote.taxMode !== "LEGACY" && (
          <button
            className="admin-btn admin-btn-small"
            disabled={pending}
            onClick={() => {
              key.current ??= crypto.randomUUID();
              void run(() => reviseQuoteAction(quote.id, key.current!), true);
            }}
          >
            Create revision draft
          </button>
        )}
      {canEdit && quote.status === "SENT" && (
        <fieldset disabled={pending}>
          <p>
            Record a decision after speaking with the customer. This is a staff record, not a
            customer login or digital signature.
          </p>
          {quote.expired && (
            <p>This offer has expired. Issue a revised offer before recording acceptance.</p>
          )}
          <label htmlFor="decision-reason">Customer communication / decision reference</label>
          <textarea
            id="decision-reason"
            className="admin-input"
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={acknowledge}
              onChange={(event) => setAck(event.target.checked)}
            />{" "}
            I confirm this is a staff record of customer communication.
          </label>
          {quote.projectId && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={advance}
                  onChange={(event) => setAdvance(event.target.checked)}
                />{" "}
                On acceptance, move the linked project to Procurement.
              </label>
              {advance && (
                <>
                  <label htmlFor="stage-reason">Reason if skipping project stages</label>
                  <textarea
                    id="stage-reason"
                    className="admin-input"
                    maxLength={1000}
                    value={stageReason}
                    onChange={(event) => setStageReason(event.target.value)}
                  />
                </>
              )}
            </>
          )}
          <div className="quote-actions">
            <button
              className="admin-btn"
              disabled={!acknowledge || !reason.trim() || quote.expired}
              onClick={() =>
                void run(() =>
                  decisionQuoteAction(quote.id, true, {
                    reason,
                    acknowledge,
                    advanceProject: advance,
                    stageReason
                  })
                )
              }
            >
              Record acceptance
            </button>
            <button
              className="admin-btn admin-btn-small"
              disabled={!acknowledge || !reason.trim()}
              onClick={() =>
                void run(() => decisionQuoteAction(quote.id, false, { reason, acknowledge }))
              }
            >
              Record rejection
            </button>
          </div>
        </fieldset>
      )}
      {pending && <p role="status">Saving quotation...</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
