"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/operations";
import { FLOW_STEPS, ROLE_GUIDANCE } from "@/lib/workflow";

const replayEvent = "sarathi:replay-workflow-tour";
export function ReplayTourButton() {
  return (
    <button
      type="button"
      className="admin-btn admin-btn-secondary"
      onClick={() => window.dispatchEvent(new Event(replayEvent))}
    >
      Replay introduction
    </button>
  );
}

export function OnboardingTour({ completed, role }: { completed: boolean; role: UserRole }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const router = useRouter();
  const [open, setOpen] = useState(!completed);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const steps = [
    {
      title: "Welcome to Sarathi",
      text: "Follow one customer from enquiry to handover. This short introduction takes about a minute.",
      note: ROLE_GUIDANCE[role]
    },
    {
      title: "Start with the lead",
      text: "Capture the enquiry, contact the customer and qualify the requirement. Conversion creates the customer-linked project for survey and costing.",
      note:
        role === "VIEWER"
          ? "Open record names to view details and ask an operator to make changes."
          : "Use Add New Lead, then Convert to Project from the lead list when the requirement is ready."
    },
    {
      title: "Agree the quotation",
      text: "Review the quotation after survey and costing. Approval is separate from payment and project delivery.",
      note: "Quotation creation, editing and sending are not available here yet. Coordinate with your team’s current process; this workspace displays recorded quotations."
    },
    {
      title: "Deliver and keep the history",
      text: "Move the project through materials, installation, testing and handover. Detail pages explain the current stage and show recorded activity.",
      note: "Exceptions need a reason. You can find the full guide and replay this introduction in How it works."
    }
  ];
  useEffect(() => {
    const replay = () => {
      setStep(0);
      setError("");
      setOpen(true);
    };
    window.addEventListener(replayEvent, replay);
    return () => window.removeEventListener(replayEvent, replay);
  }, []);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!open) dialog.current?.close();
  }, [open]);
  async function dismiss() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}"
      });
      if (!response.ok) {
        setError("We couldn’t save your preference. Try again, or close for this visit.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("You appear to be offline. Try again, or close for this visit.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="workflow-tour"
      aria-labelledby="tour-title"
      aria-describedby="tour-copy"
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        void dismiss();
      }}
    >
      <div className="workflow-panel">
        <p className="eyebrow">YOUR WORKSPACE · {role}</p>
        <div aria-live="polite" aria-atomic="true">
          <p className="tw:text-sm tw:text-[var(--muted)]">
            Step {step + 1} of {steps.length}
          </p>
          <h2 id="tour-title">{steps[step].title}</h2>
          <p id="tour-copy">{steps[step].text}</p>
          {step === 0 && (
            <ol className="tw:grid tw:gap-2 tw:pl-5 tw:text-sm">
              {FLOW_STEPS.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ol>
          )}
          <p className="tw:rounded-lg tw:bg-[var(--surface-subtle)] tw:p-3 tw:text-sm">
            {steps[step].note}
          </p>
        </div>
        {error && (
          <div>
            <p role="alert" className="form-error">
              {error}
            </p>
            <button type="button" className="admin-btn" onClick={() => setOpen(false)}>
              Close for this visit
            </button>
          </div>
        )}
        <div className="tw:mt-5 tw:flex tw:flex-wrap tw:justify-between tw:gap-3">
          <button
            type="button"
            className="admin-btn"
            disabled={pending}
            onClick={() => void dismiss()}
          >
            Skip introduction
          </button>
          <div className="tw:flex tw:gap-2">
            {step > 0 && (
              <button
                type="button"
                className="admin-btn"
                disabled={pending}
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={pending}
                onClick={() => setStep(step + 1)}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={pending}
                onClick={() => void dismiss()}
              >
                {pending ? "Saving…" : "Start exploring"}
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
