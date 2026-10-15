import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/server/dal";
import { paymentDetail } from "@/server/payments";
import { AccessDeniedError, InputError } from "@/server/mutation-errors";
import { formatIndiaDate } from "@/lib/date";
import { PaymentForm, AllocationForm } from "../payment-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Payment details" };
export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ after?: string }>;
}) {
  const h = await headers();
  if (!(await getActor(h))) redirect("/admin/login");
  const { id } = await params,
    query = await searchParams;
  const data = await paymentDetail(h, id, query.after).catch((error) => {
    if (error instanceof InputError) notFound();
    if (error instanceof AccessDeniedError) redirect("/admin");
    throw error;
  });
  const { payment: p, balance: b, remaining: r } = data;
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main payment-detail">
        <Link href="/admin/payments">← Payments & receipts</Link>
        <section className="workspace-heading">
          <h1>{p.number ?? "Historical payment"}</h1>
          <p className="lead-copy">
            {p.kind} · {p.divisionName}
          </p>
        </section>
        <section className="workflow-panel" aria-label="Payment information">
          <h2>
            ₹{p.amount}{" "}
            {p.purpose === "REVERSAL"
              ? "receipt correction"
              : p.kind === "REFUND"
                ? "refunded"
                : "received"}
          </h2>
          <p>
            Customer: <Link href={"/admin/customers/" + p.customerId}>{p.customerName}</Link>
          </p>
          <p>
            {p.projectId ? (
              <Link href={"/admin/projects/" + p.projectId}>{p.projectName}</Link>
            ) : (
              "Standalone quotation"
            )}
            {p.quotationId && (
              <>
                {" "}
                ·{" "}
                <Link href={"/admin/quotes/" + p.quotationId}>
                  {p.quotationNumber ?? "Quotation"}
                </Link>
              </>
            )}
          </p>
          <p>
            {p.method.replaceAll("_", " ")} · {p.purpose ?? "Historical purpose"} · Reference:{" "}
            {p.reference ?? "—"}
          </p>
          <p>
            Payment time: {formatIndiaDate(p.occurredAt)} · Recorded {formatIndiaDate(p.recordedAt)}{" "}
            by {p.recordedBy}
          </p>
          {p.note && <p className="payment-note">{p.note}</p>}
          {p.refundOfId && (
            <p>
              <Link href={"/admin/payments/" + p.refundOfId}>Original receipt</Link>
            </p>
          )}
          {p.hasDocument ? (
            <a className="admin-btn" href={"/api/admin/payments/" + p.id + "/pdf"}>
              Download private{" "}
              {p.purpose === "REVERSAL"
                ? "receipt correction"
                : p.kind === "REFUND"
                  ? "refund acknowledgement"
                  : "receipt"}{" "}
              PDF
            </a>
          ) : (
            <p>No PDF was stored for this historical record.</p>
          )}
        </section>
        <section className="workflow-panel" aria-label="Authoritative balance">
          <h2>Current {p.projectId ? "project" : "quotation family"} balance</h2>
          <dl className="customer-contact-grid">
            <div>
              <dt>Accepted total</dt>
              <dd>{b.total === null ? "No accepted baseline" : "₹" + b.total}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>₹{b.received}</dd>
            </div>
            <div>
              <dt>Refunded</dt>
              <dd>₹{b.refunded}</dd>
            </div>
            <div>
              <dt>Receipt corrections</dt>
              <dd>₹{b.reversed}</dd>
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
            Calculated from the current accepted quotation and all recorded receipts/refunds in this
            scope. Allocations do not add another payment. This is a commercial balance, not a tax
            invoice.
          </p>
          {b.baselineId && (
            <Link href={"/admin/quotes/" + b.baselineId}>Current accepted baseline</Link>
          )}
          {p.kind === "RECEIPT" && (
            <p>
              This receipt: refunded / reversed ₹{p.refunded} · allocated ₹{p.allocated} ·
              unallocated ₹{r.unallocated}.
            </p>
          )}
        </section>
        {p.kind === "RECEIPT" &&
          p.current &&
          data.permissions.includes("payments.allocate") &&
          r.unallocated !== "0.00" &&
          b.baselineId && (
            <AllocationForm
              key={p.id + ":" + b.baselineId}
              receiptId={p.id}
              quotationId={b.baselineId}
              number={b.baselineNumber}
              maximum={r.unallocated}
            />
          )}
        {p.kind === "RECEIPT" &&
          p.current &&
          data.permissions.includes("payments.refund") &&
          r.refundable !== "0.00" && (
            <PaymentForm key={p.id} refundOfId={p.id} maximum={r.refundable} />
          )}
        <section className="workflow-panel" aria-label="Payment audit history">
          <h2>Payment and allocation history</h2>
          {data.events.length === 0 ? (
            <p>No new workflow audit was stored for this historical record.</p>
          ) : (
            <ol>
              {data.events.map((e) => (
                <li key={e.id}>
                  <strong>{e.event.replaceAll("_", " ")}</strong> · ₹{e.amount} · {e.actor} ·{" "}
                  {formatIndiaDate(e.at)}
                  {e.paymentId !== p.id && (
                    <>
                      {" "}
                      · <Link href={"/admin/payments/" + e.paymentId}>Open adjustment record</Link>
                    </>
                  )}
                  {e.quotationId && (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={"/admin/quotes/" + e.quotationId}>{e.number ?? "Quotation"}</Link>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
          <p>Up to 50 immutable events per page.</p>
          {query.after && <Link href={"/admin/payments/" + p.id}>Latest events</Link>}
          {data.next && (
            <Link href={"/admin/payments/" + p.id + "?after=" + data.next}>Older events</Link>
          )}
        </section>
      </main>
    </div>
  );
}
