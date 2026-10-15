import { RecordDetail } from "@/components/workflow/record-detail";
import { quotationDetail } from "@/server/quotations";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/server/dal";
import Link from "next/link";
import { QuoteControls } from "../quote-controls";
import { quoteStatusLabel } from "@/lib/quotation-money";
import { PaymentSummary } from "@/components/workflow/payment-summary";
export const metadata = { title: "Quotation details" };
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eventsAfter?: string; versionsAfter?: string }>;
}) {
  const h = await headers();
  if (!(await getActor(h))) redirect("/admin/login");
  const { id } = await params;
  const search = await searchParams;
  const data = await quotationDetail(h, id, search.eventsAfter, search.versionsAfter);
  if (!data) notFound();
  const q = data.quote;
  return (
    <RecordDetail kind="quote" id={id}>
      <PaymentSummary kind="quote" id={id} />
      <section className="workflow-panel" aria-label="Quotation items">
        <h2>{q.quotationNumber ?? "Draft awaiting issue"}</h2>
        <p>
          {q.divisionName} · {quoteStatusLabel(q.status, q.expired)} · Valid until {q.validUntil}
        </p>
        {q.items.length ? (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity / unit</th>
                  <th>Rate INR</th>
                  <th>Amount INR</th>
                  <th>Discount INR</th>
                  <th>Tax INR</th>
                  <th>Total INR</th>
                </tr>
              </thead>
              <tbody>
                {q.items.map((item, i) => (
                  <tr key={i}>
                    <td className="quote-description">{item.description}</td>
                    <td>
                      {item.quantity} {item.unit}
                    </td>
                    <td>{item.rate}</td>
                    <td>{item.amount ?? "Historic"}</td>
                    <td>{item.discount ?? "Historic"}</td>
                    <td>{item.tax ?? "Historic"}</td>
                    <td>{item.total ?? "Historic"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No item breakdown was stored for this historical quotation.</p>
        )}
        <p>
          <strong>Saved total: ₹{q.total}</strong> ·{" "}
          {q.taxMode === "NONE"
            ? "No GST charged"
            : q.taxMode === "LEGACY"
              ? "Historic tax treatment"
              : q.taxMode === "GST_INCLUSIVE"
                ? "GST included"
                : "GST added"}
        </p>
      </section>
      <QuoteControls
        quote={q}
        canEdit={data.canEdit}
        canCreate={data.canCreate && q.version === q.latestVersion}
      />
      <section className="workflow-panel" aria-label="Quotation version history">
        <h2>Version history</h2>
        <p>
          Up to 25 versions per page. Issued content and PDFs stay fixed when a new revision is
          prepared.
        </p>
        <ul>
          {data.versions.map((version) => (
            <li key={version.id}>
              <Link href={"/admin/quotes/" + version.id}>
                Version {version.version} · {quoteStatusLabel(version.status)}
              </Link>
            </li>
          ))}
        </ul>
        {data.versionsNext && (
          <Link href={"/admin/quotes/" + id + "?versionsAfter=" + data.versionsNext}>
            Older quotation versions
          </Link>
        )}
        {search.versionsAfter && (
          <p>
            <Link href={"/admin/quotes/" + id}>Latest versions</Link>
          </p>
        )}
      </section>
      <section className="workflow-panel" aria-label="Quotation audit history">
        <h2>Quotation audit history</h2>
        <p>Up to 25 events per page. Acceptance and rejection are staff records.</p>
        <ol>
          {data.events.map((event) => (
            <li key={event.id}>
              <strong>{event.event.replaceAll("_", " ")}</strong> · {event.at} IST ·{" "}
              {event.actor ?? "Owner maintenance"}
              {event.reason && <p>{event.reason}</p>}
            </li>
          ))}
        </ol>
        {data.next && (
          <Link href={"/admin/quotes/" + id + "?eventsAfter=" + data.next}>
            Older quotation events
          </Link>
        )}
      </section>
    </RecordDetail>
  );
}
