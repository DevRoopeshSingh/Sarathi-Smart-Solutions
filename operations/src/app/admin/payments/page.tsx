import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminActor, getPayments } from "@/server/dal";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const requestHeaders = await headers();
  if (!(await getAdminActor(requestHeaders))) redirect("/admin/login");

  const payments = await getPayments(requestHeaders);

  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <section className="workspace-heading">
          <span className="eyebrow">
            <span className="small-rule" />
            FINANCIAL AUDIT
          </span>
          <h1>Payments & Receipts</h1>
          <p className="lead-copy">
            Append-only financial ledger tracking advances, progress receipts, and refunds.
          </p>
        </section>

        <div className="admin-view">
          {payments.length === 0 ? (
            <div className="empty-state">
              <p>No payments recorded yet.</p>
              <p className="table-subtext">
                Payments are recorded against approved project quotations.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Kind</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => (
                    <tr key={pay.id}>
                      <td>
                        <strong>{pay.projectName}</strong>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${pay.kind === "RECEIPT" ? "badge-completed" : "badge-lost"}`}
                        >
                          {pay.kind}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {pay.kind === "RECEIPT" ? "+" : "-"}₹{pay.amount}
                        </strong>
                      </td>
                      <td>{pay.paymentMethod}</td>
                      <td>{pay.reference || "—"}</td>
                      <td className="table-subtext">{pay.createdAt}</td>
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
