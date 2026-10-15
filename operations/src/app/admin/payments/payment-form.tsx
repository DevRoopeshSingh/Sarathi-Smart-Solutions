"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAYMENT_METHODS, PAYMENT_PURPOSES } from "@/lib/payments";
import type { PaymentTarget } from "@/server/payments";
import {
  savePaymentAction,
  allocatePaymentAction,
  findPaymentSubmissionAction,
  findAllocationSubmissionAction
} from "./actions";
export function PaymentForm({
  projects = [],
  quotations = [],
  selectedProject = "",
  selectedQuote = "",
  refundOfId,
  maximum
}: {
  projects?: PaymentTarget[];
  quotations?: PaymentTarget[];
  selectedProject?: string;
  selectedQuote?: string;
  refundOfId?: string;
  maximum?: string;
}) {
  const [project, setProject] = useState(selectedProject),
    [quotation, setQuotation] = useState(selectedQuote);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [correction, setCorrection] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const storageKey = useRef("");
  const key = useRef(""),
    busy = useRef(false),
    router = useRouter();
  useEffect(() => {
    // Store only a retry UUID, never customer/payment form contents.
    storageKey.current = "sarathi-payment-submission:" + (refundOfId ?? "new-receipt");
    let previous: string | null = null;
    try {
      previous = sessionStorage.getItem(storageKey.current);
    } catch {
      /* Private storage unavailable; retain the in-memory retry reference. */
    }
    if (!previous) return;
    key.current = previous;
    busy.current = true;
    setPending(true);
    void findPaymentSubmissionAction(previous)
      .then((result) => {
        if ("error" in result) setError(result.error);
        else if (result.id) {
          try {
            sessionStorage.removeItem(storageKey.current);
          } catch {
            /* Optional browser storage. */
          }
          router.replace("/admin/payments/" + result.id);
        }
      })
      .catch(() =>
        setError("Unable to check the previous submission. Retry the same details safely.")
      )
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  }, [refundOfId, router]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    key.current ||= crypto.randomUUID();
    try {
      sessionStorage.setItem(storageKey.current, key.current);
    } catch {
      /* The server still protects this form's retry reference. */
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await savePaymentAction(
        {
          projectId: refundOfId ? undefined : project,
          quotationId: refundOfId ? undefined : quotation,
          refundOfId,
          amount: String(form.get("amount") ?? ""),
          method: correction ? "CORRECTION" : String(form.get("method") ?? ""),
          reference: String(form.get("reference") ?? ""),
          note: String(form.get("note") ?? ""),
          occurredAt: String(form.get("occurredAt") ?? "") + ":00+05:30",
          purpose: refundOfId
            ? correction
              ? "REVERSAL"
              : "REFUND"
            : String(form.get("purpose") ?? ""),
          acknowledge: form.get("acknowledge") === "on"
        },
        key.current
      );
      if ("error" in result) setError(result.error);
      else {
        try {
          sessionStorage.removeItem(storageKey.current);
        } catch {
          /* Optional browser storage. */
        }
        router.push("/admin/payments/" + result.id);
        router.refresh();
      }
    } catch {
      setError(
        "The save response was interrupted. Retry the same details to check this submission safely."
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <section
      className="workflow-panel quote-editor payment-editor"
      aria-label={refundOfId ? "Record refund" : "Record receipt"}
    >
      <h2>
        {correction
          ? "Reverse an incorrect receipt"
          : refundOfId
            ? "Record a completed refund"
            : "Record money received"}
      </h2>
      <p>
        {refundOfId
          ? correction
            ? "An administrator reverses an incorrect receipt entry with a reason. This does not record a cash refund or send money."
            : "An administrator records a refund already made against this receipt. This action does not send money."
          : "Record an actual receipt. A project advance can be allocated after a quotation is accepted."}
      </p>
      {maximum && <p>Remaining refundable amount: ₹{maximum}</p>}
      <form onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending}>
          {refundOfId && (
            <>
              <label htmlFor="payment-adjustment-kind">Entry type</label>
              <select
                id="payment-adjustment-kind"
                className="admin-input"
                value={correction ? "REVERSAL" : "REFUND"}
                onChange={(e) => {
                  setCorrection(e.target.value === "REVERSAL");
                  setAcknowledged(false);
                }}
              >
                <option value="REFUND">Completed cash / bank refund</option>
                <option value="REVERSAL">Reverse an incorrect receipt (no money movement)</option>
              </select>
            </>
          )}
          {!refundOfId && (
            <>
              <label htmlFor="payment-project">
                Project for an advance (or select a quotation below)
              </label>
              <select
                id="payment-project"
                className="admin-input"
                value={project}
                onChange={(e) => {
                  setProject(e.target.value);
                  setQuotation("");
                }}
              >
                <option value="">Select a project / standalone quotation below</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <label htmlFor="payment-quotation">
                Accepted quotation (optional for a project advance)
              </label>
              <select
                id="payment-quotation"
                className="admin-input"
                value={quotation}
                onChange={(e) => {
                  setQuotation(e.target.value);
                  const q = quotations.find((q) => q.id === e.target.value);
                  if (q) setProject(q.projectId ?? "");
                }}
              >
                <option value="">Unallocated project advance</option>
                {quotations
                  .filter((q) => !project || !q.projectId || q.projectId === project)
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.label}
                    </option>
                  ))}
              </select>
            </>
          )}
          <label htmlFor={"payment-amount" + (refundOfId ?? "")}>Amount (INR)</label>
          <input
            id={"payment-amount" + (refundOfId ?? "")}
            name="amount"
            className="admin-input"
            inputMode="decimal"
            required
            pattern="[0-9]+(\.[0-9]{1,2})?"
            maxLength={15}
            placeholder="0.00"
          />
          {!correction && (
            <>
              <label htmlFor="payment-method">Method</label>
              <select id="payment-method" name="method" className="admin-input">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </>
          )}
          {!refundOfId && (
            <>
              <label htmlFor="payment-purpose">Purpose</label>
              <select id="payment-purpose" name="purpose" className="admin-input">
                {PAYMENT_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="payment-reference">Transaction reference (required except cash)</label>
          <input id="payment-reference" name="reference" className="admin-input" maxLength={200} />
          <label htmlFor="payment-time">Payment / refund time (India time)</label>
          <input
            id="payment-time"
            name="occurredAt"
            type="datetime-local"
            required
            className="admin-input"
            defaultValue={new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16)}
          />
          <label htmlFor="payment-note">
            {correction
              ? "Correction reason (at least eight characters)"
              : refundOfId
                ? "Refund reason (at least eight characters)"
                : "Staff note (optional)"}
          </label>
          <textarea
            id="payment-note"
            name="note"
            className="admin-input"
            maxLength={2000}
            required={!!refundOfId}
            minLength={refundOfId ? 8 : undefined}
          />
          <label className="quote-confirm">
            <input
              type="checkbox"
              name="acknowledge"
              required
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />{" "}
            {correction ? (
              "I confirm this reverses an incorrect receipt; no money is moved."
            ) : (
              <>I confirm this records money already {refundOfId ? "refunded" : "received"}.</>
            )}
          </label>
        </fieldset>
        {error && (
          <p className="form-error-banner" role="alert">
            {error}
          </p>
        )}
        <button className="admin-btn" disabled={pending} type="submit">
          {pending
            ? "Saving…"
            : correction
              ? "Save correction record"
              : refundOfId
                ? "Save refund record"
                : "Save receipt"}
        </button>
      </form>
    </section>
  );
}
export function AllocationForm({
  receiptId,
  quotationId,
  number,
  maximum
}: {
  receiptId: string;
  quotationId: string;
  number: string | null;
  maximum: string;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const storageKey = "sarathi-allocation-submission:" + receiptId;
  const key = useRef(""),
    busy = useRef(false),
    router = useRouter();
  useEffect(() => {
    let previous: string | null = null;
    try {
      previous = sessionStorage.getItem(storageKey);
    } catch {
      /* Optional browser storage. */
    }
    if (!previous) return;
    key.current = previous;
    busy.current = true;
    setPending(true);
    void findAllocationSubmissionAction(previous)
      .then((result) => {
        if ("error" in result) setError(result.error);
        else if (result.id) {
          try {
            sessionStorage.removeItem(storageKey);
          } catch {
            /* Optional browser storage. */
          }
          key.current = "";
          setNotice(
            "The previous allocation was saved. Review the updated receipt before entering another allocation."
          );
          if (result.id !== receiptId) router.replace("/admin/payments/" + result.id);
          else router.refresh();
        }
      })
      .catch(() =>
        setError("Unable to check the previous allocation. Retry the same amount safely.")
      )
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  }, [storageKey, receiptId, router]);
  return (
    <section className="workflow-panel quote-editor" aria-label="Allocate advance">
      <h2>Allocate this advance</h2>
      <p>
        Unallocated: ₹{maximum}. Apply an amount to the current accepted quotation{" "}
        {number ?? quotationId}. The receipt and its history stay unchanged.
      </p>
      <form
        aria-busy={pending}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy.current) return;
          const form = e.currentTarget;
          const amount = String(new FormData(form).get("amount") ?? "");
          key.current ||= crypto.randomUUID();
          try {
            sessionStorage.setItem(storageKey, key.current);
          } catch {
            /* Retain the in-memory retry reference. */
          }
          busy.current = true;
          setPending(true);
          setError("");
          try {
            const result = await allocatePaymentAction(receiptId, quotationId, amount, key.current);
            if ("error" in result) setError(result.error);
            else {
              try {
                sessionStorage.removeItem(storageKey);
              } catch {
                /* Optional browser storage. */
              }
              form.reset();
              key.current = "";
              router.refresh();
            }
          } catch {
            setError("Unable to confirm the allocation. Retry the same amount safely.");
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        <label htmlFor="allocation-amount">Amount to allocate (INR)</label>
        {notice && <p role="status">{notice}</p>}
        <input
          id="allocation-amount"
          name="amount"
          className="admin-input"
          required
          inputMode="decimal"
          pattern="[0-9]+(\.[0-9]{1,2})?"
          disabled={pending}
        />
        {error && (
          <p role="alert" className="form-error-banner">
            {error}
          </p>
        )}
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : "Allocate advance"}
        </button>
      </form>
    </section>
  );
}
