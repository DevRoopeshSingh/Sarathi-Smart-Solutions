import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getActor } from "@/server/dal";
import { paymentTargets } from "@/server/payments";
import { AccessDeniedError, InputError } from "@/server/mutation-errors";
import { PaymentForm } from "../payment-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Record receipt" };
export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ q?: string; projectId?: string; quotationId?: string }>;
}) {
  const h = await headers();
  if (!(await getActor(h))) redirect("/admin/login");
  const query = await searchParams;
  const data = await paymentTargets(h, query.q, query.projectId, query.quotationId).catch(
    (error) => {
      if (error instanceof AccessDeniedError) redirect("/admin/payments");
      if (error instanceof InputError) notFound();
      throw error;
    }
  );
  if (query.projectId && !data.projects.some((p) => p.id === query.projectId)) notFound();
  if (query.quotationId && !data.quotations.some((q) => q.id === query.quotationId)) notFound();
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <Link href="/admin/payments">← Payments & receipts</Link>
        <section className="workspace-heading">
          <h1>Record receipt</h1>
          <p className="lead-copy">
            Select the authorized project or accepted standalone quotation.
          </p>
        </section>
        <form className="toolbar-search">
          <label htmlFor="payment-target-search">Find project / quotation</label>
          <input
            id="payment-target-search"
            name="q"
            type="search"
            maxLength={100}
            className="admin-input"
            defaultValue={query.q}
          />
          <button className="admin-btn" type="submit">
            Search targets
          </button>
        </form>
        <p>Up to 30 projects and quotations are listed. Search to locate older records.</p>
        <PaymentForm
          key={[query.q ?? "", query.projectId ?? "", query.quotationId ?? ""].join(":")}
          projects={data.projects}
          quotations={data.quotations}
          selectedProject={
            query.projectId ??
            data.quotations.find((q) => q.id === query.quotationId)?.projectId ??
            ""
          }
          selectedQuote={query.quotationId}
        />
      </main>
    </div>
  );
}
