"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerRecord } from "@/lib/operations";
import { validCustomerPhone, type CustomerDuplicate } from "@/lib/customer-contact";
import { createCustomerAction, updateCustomerAction } from "../actions";

export function CustomerForm({
  customer,
  onClose,
  onSaved
}: {
  customer?: CustomerRecord;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<CustomerDuplicate[]>([]);
  const [confirmation, setConfirmation] = useState(false);
  const request = useRef<string>("");
  const saving = useRef(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const form = new FormData(event.currentTarget);
    if (!validCustomerPhone(String(form.get("phone") ?? "").trim())) {
      setError("Enter a valid phone number with 7–15 digits.");
      return;
    }
    if (!request.current) request.current = crypto.randomUUID();
    form.set("requestId", request.current);
    form.set("confirmDuplicates", String(confirmation));
    saving.current = true;
    setPending(true);
    setError("");
    try {
      const result = customer ? await updateCustomerAction(form) : await createCustomerAction(form);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("duplicates" in result) {
        setMatches(result.duplicates);
        return;
      }
      onSaved?.();
      onClose();
      router.refresh();
    } catch {
      setError("Unable to confirm the save. Retry this form to check the same submission safely.");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="modal-form"
      aria-busy={pending}
      onChange={() => {
        setMatches([]);
        setConfirmation(false);
        setError("");
      }}
    >
      {customer && (
        <>
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="version" value={customer.version} />
        </>
      )}
      {error && (
        <div className="form-error-banner" role="alert">
          {error}
        </div>
      )}
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="form-group">
          <label htmlFor="customerName">Full Name / Business Name *</label>
          <input
            autoFocus
            id="customerName"
            name="name"
            required
            maxLength={200}
            defaultValue={customer?.name ?? ""}
            className="admin-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="customerPhone">Mobile Number *</label>
          <input
            id="customerPhone"
            name="phone"
            type="tel"
            required
            maxLength={32}
            defaultValue={customer?.phone ?? ""}
            placeholder="e.g. 9820098200"
            className="admin-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="customerEmail">Email Address (Optional)</label>
          <input
            id="customerEmail"
            name="email"
            type="email"
            maxLength={254}
            defaultValue={customer?.email ?? ""}
            className="admin-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="customerAddress">Address / Locality (Optional)</label>
          <textarea
            id="customerAddress"
            name="address"
            maxLength={1000}
            rows={2}
            defaultValue={customer?.address ?? ""}
            className="admin-input"
          />
        </div>
      </fieldset>
      {matches.length > 0 && (
        <section role="alert" aria-label="Possible existing customers">
          <p>
            <strong>Review possible existing customers</strong>
          </p>
          <p>
            Matching phone numbers are strong matches. Similar names may belong to someone else. No
            customer has been created.
          </p>
          <ul>
            {matches.map((match) => (
              <li key={match.id}>
                <Link href={`/admin/customers/${match.id}`}>{match.name}</Link> · {match.phone} ·{" "}
                {match.match === "PHONE" ? "Matching phone" : "Similar name"}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending}
            className="admin-btn admin-btn-secondary"
            onClick={() => {
              setConfirmation(true);
              setMatches([]);
            }}
          >
            Create separate customer
          </button>
        </section>
      )}
      {confirmation && (
        <p role="status">Confirmed as a different customer. Save to create a separate profile.</p>
      )}
      <div className="modal-footer">
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          className="admin-btn admin-btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || matches.length > 0}
          className="admin-btn admin-btn-primary"
        >
          {pending ? "Saving..." : customer ? "Save Changes" : "Save Customer"}
        </button>
      </div>
    </form>
  );
}
export function CustomerEditor({
  customer,
  canEdit
}: {
  customer: CustomerRecord;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <p role="status">{saved ? "Customer details saved." : ""}</p>
      {canEdit && (
        <button
          className="admin-btn admin-btn-primary"
          onClick={() => {
            setOpen(true);
            setSaved(false);
          }}
        >
          Edit Customer
        </button>
      )}
      {open && (
        <CustomerDialog title="Edit Customer Profile" onClose={() => setOpen(false)}>
          <CustomerForm
            customer={customer}
            onClose={() => setOpen(false)}
            onSaved={() => setSaved(true)}
          />
        </CustomerDialog>
      )}
    </>
  );
}
// Native dialog provides focus containment, Escape handling and focus restoration.
// Closing is disabled while a save is pending, including backdrop and Escape.
export function CustomerDialog({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <dialog
      ref={(el) => {
        ref.current = el;
        if (el && !el.open) el.showModal();
      }}
      className="customer-dialog modal-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!ref.current?.querySelector('[aria-busy="true"]')) onClose();
      }}
    >
      <div className="modal-header">
        <h3>{title}</h3>
        <button
          type="button"
          aria-label="Close customer form"
          className="modal-close"
          onClick={() => {
            if (!ref.current?.querySelector('[aria-busy="true"]')) onClose();
          }}
        >
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
