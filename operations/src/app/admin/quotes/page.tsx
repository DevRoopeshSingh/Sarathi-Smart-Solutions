import { quoteStatusLabel } from "@/lib/quotation-money";
import { QuoteFilters } from "./quote-filters";
import { StageTooltip } from "@/components/workflow/stage-tooltip";
import { LifecycleDiagram } from "@/components/workflow/lifecycle-diagram";
import { formatIndiaDate } from "@/lib/date";
import { ListNavigation } from "../list-controls";
import { readListQuery, type SearchParameters } from "@/server/lists";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminActor, getQuotations } from "@/server/dal";

export const metadata: Metadata = { title: "Quotations" };
export const dynamic = "force-dynamic";

export default async function QuotesPage({
  searchParams
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const query = readListQuery(await searchParams);
  const requestHeaders = await headers();
  const actor = await getAdminActor(requestHeaders);
  if (!actor) redirect("/admin/login");

  const result = await getQuotations(requestHeaders, query);

  const quotes = result.items;
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <section className="workspace-heading">
          <span className="eyebrow">
            <span className="small-rule" />
            COMMERCIAL QUOTATIONS
          </span>
          <h1>Quotations & Estimates</h1>
          <p className="lead-copy">
            Prepare standalone service estimates or project quotations, then issue a fixed PDF and
            record customer decisions.
          </p>
        </section>

        <LifecycleDiagram current="quote" />
        <p className="lead-copy">
          Save a draft before issuing. Acceptance is recorded by staff after customer communication.
        </p>
        {actor.role !== "VIEWER" && (
          <Link href="/admin/quotes/new" className="admin-btn">
            Create quotation
          </Link>
        )}
        <QuoteFilters />
        <ListNavigation
          query={query}
          total={result.total}
          next={result.next}
          base="/admin/quotes"
          search
        />
        <div className="admin-view">
          {quotes.length === 0 ? (
            <div className="empty-state">
              <p>No quotations created yet.</p>
              <p className="table-subtext">
                Quotations are prepared from project costings and BOM items.
              </p>
              <Link href="/admin/projects" className="admin-btn admin-btn-small">
                Go to Projects →
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Customer</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Subtotal</th>
                    <th>Discount</th>
                    <th>Tax</th>
                    <th>Total</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <strong>
                          <Link href={`/admin/quotes/${q.id}`}>
                            {q.quotationNumber ?? q.projectName} · v{q.version}
                          </Link>
                        </strong>
                      </td>
                      <td>{q.customerName}</td>
                      <td>
                        <span className="version-pill">v{q.version}</span>
                      </td>
                      <td>
                        <span className={`status-badge badge-${q.status.toLowerCase()}`}>
                          {quoteStatusLabel(q.status, q.expired)}
                        </span>
                        <StageTooltip kind="quote" status={q.status} />
                      </td>
                      <td>₹{q.subtotal}</td>
                      <td>{q.discount !== "0.00" ? `-₹${q.discount}` : "—"}</td>
                      <td>₹{q.taxAmount}</td>
                      <td>
                        <strong>₹{q.quoteTotal}</strong>
                      </td>
                      <td className="table-subtext">{formatIndiaDate(q.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
