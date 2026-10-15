import Link from "next/link";
import { headers } from "next/headers";
import { financialSummary } from "@/server/payments";
import { AccessDeniedError, InputError } from "@/server/mutation-errors";
export async function PaymentSummary({ kind, id }: { kind: "project" | "quote"; id: string }) {
  const data = await financialSummary(await headers(), kind, id).catch((error) => {
    if (error instanceof AccessDeniedError || error instanceof InputError) return null;
    throw error;
  });
  if (!data) return null;
  const b = data.balance,
    href = data.quotationId
      ? "/admin/payments/new?quotationId=" + data.quotationId
      : data.projectId
        ? "/admin/payments/new?projectId=" + data.projectId
        : null;
  return (
    <section className="workflow-panel" aria-label="Current financial balance">
      <h2>Current accepted balance</h2>
      <dl className="customer-contact-grid">
        <div>
          <dt>Accepted total</dt>
          <dd>{b.total === null ? "No accepted baseline" : "₹" + b.total}</dd>
        </div>
        <div>
          <dt>Net received</dt>
          <dd>₹{b.net}</dd>
        </div>
        <div>
          <dt>Outstanding</dt>
          <dd>{b.outstanding === null ? "Not determined" : "₹" + b.outstanding}</dd>
        </div>
        <div>
          <dt>Credit / advance held</dt>
          <dd>₹{b.credit}</dd>
        </div>
      </dl>
      <p>
        Gross receipts ₹{b.received} · refunds ₹{b.refunded} · receipt corrections ₹{b.reversed}.
        These totals use the current accepted quotation and preserved ledger, including advances.
        Allocations never add a second payment.
      </p>
      {data.canCreate && href && (
        <Link className="admin-btn" href={href}>
          Record receipt
        </Link>
      )}
      {b.baselineId && (
        <p>
          <Link href={"/admin/quotes/" + b.baselineId}>Current accepted quotation</Link>
        </p>
      )}
      <Link href="/admin/payments">Open payments ledger</Link>
    </section>
  );
}
