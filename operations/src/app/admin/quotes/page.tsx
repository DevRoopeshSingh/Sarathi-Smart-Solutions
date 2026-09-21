import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminActor, getQuotations } from "@/server/dal";

export const metadata: Metadata = { title: "Quotations" };
export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const requestHeaders = await headers();
  if (!(await getAdminActor(requestHeaders))) redirect("/admin/login");

  const quotes = await getQuotations(requestHeaders);

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
            Version-controlled quotations derived from site surveys and bill of materials (BOM).
          </p>
        </section>

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
                        <strong>{q.projectName}</strong>
                      </td>
                      <td>{q.customerName}</td>
                      <td>
                        <span className="version-pill">v{q.version}</span>
                      </td>
                      <td>
                        <span className={`status-badge badge-${q.status.toLowerCase()}`}>
                          {q.status}
                        </span>
                      </td>
                      <td>₹{q.subtotal}</td>
                      <td>{q.discount !== "0.00" ? `-₹${q.discount}` : "—"}</td>
                      <td>₹{q.taxAmount}</td>
                      <td>
                        <strong>₹{q.quoteTotal}</strong>
                      </td>
                      <td className="table-subtext">{q.createdAt}</td>
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
