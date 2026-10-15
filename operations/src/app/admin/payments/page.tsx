import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminActor, authorizedDatabase } from "@/server/dal";
import { paymentList } from "@/server/payments";
import { readListQuery, type SearchParameters } from "@/server/lists";
import { ListNavigation } from "../list-controls";
import { formatIndiaDate } from "@/lib/date";
export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";
export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const h = await headers(),
    actor = await getAdminActor(h);
  if (!actor) redirect("/admin/login");
  if (actor.role === "VIEWER") redirect("/admin");
  const query = readListQuery(await searchParams),
    result = await paymentList(h, query),
    { context } = await authorizedDatabase(h, "payments.read");
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <section className="workspace-heading">
          <span className="eyebrow">FINANCIAL AUDIT</span>
          <h1>Payments & Receipts</h1>
          <p className="lead-copy">
            Append-only receipts, advances, allocations and reasoned refunds. Records acknowledge
            completed payments; this app does not transfer money.
          </p>
          {context.permissions.includes("payments.create") && (
            <Link className="admin-btn" href="/admin/payments/new">
              Record receipt
            </Link>
          )}
        </section>
        <ListNavigation
          query={query}
          total={result.total}
          next={result.next}
          base="/admin/payments"
          search
        />
        <nav className="customer-tabs" aria-label="Payment kind">
          <Link href="/admin/payments">All entries</Link>
          <Link href="/admin/payments?status=RECEIPT">Receipts</Link>
          <Link href="/admin/payments?status=REFUND">Refunds</Link>
          <Link href="/admin/payments?status=REVERSAL">Receipt corrections</Link>
        </nav>
        <div className="admin-view">
          {result.items.length === 0 ? (
            <div className="empty-state">
              <p>No payments recorded yet.</p>
              <p className="table-subtext">
                Record a project advance or a receipt against an accepted quotation.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Receipt / refund</th>
                    <th>Customer / project</th>
                    <th>Kind</th>
                    <th>Amount INR</th>
                    <th>Method / reference</th>
                    <th>Payment time</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={"/admin/payments/" + p.id}>
                          {p.number ?? "Historical payment " + p.id}
                        </Link>
                        <p className="table-subtext">{p.divisionName}</p>
                      </td>
                      <td>
                        {p.customerName}
                        <p className="table-subtext">{p.projectName ?? "Standalone quotation"}</p>
                      </td>
                      <td>{p.purpose === "REVERSAL" ? "RECEIPT CORRECTION" : p.kind}</td>
                      <td>
                        {p.kind === "REFUND" ? "−" : "+"}₹{p.amount}
                      </td>
                      <td>
                        {p.method.replaceAll("_", " ")}
                        <p className="table-subtext">{p.reference ?? "—"}</p>
                      </td>
                      <td>{formatIndiaDate(p.occurredAt)}</td>
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
