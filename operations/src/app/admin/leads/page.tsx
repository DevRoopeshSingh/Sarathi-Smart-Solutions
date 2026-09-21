import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminActor, getCustomers, getLeads } from "@/server/dal";
import { LeadsManager } from "./leads-manager";

export const metadata: Metadata = { title: "Leads & Enquiries" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const requestHeaders = await headers();
  if (!(await getAdminActor(requestHeaders))) redirect("/admin/login");

  const [leads, customers] = await Promise.all([
    getLeads(requestHeaders),
    getCustomers(requestHeaders)
  ]);

  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main p-4 md:p-6 lg:p-8">
        <section className="workspace-heading">
          <span className="eyebrow">
            <span className="small-rule" />
            LEAD PIPELINE
          </span>
          <h1>Leads & Enquiries</h1>
          <p className="lead-copy">
            Track customer enquiries, qualify requirements, and convert into billable projects.
          </p>
        </section>

        <LeadsManager initialLeads={leads} customers={customers} />
      </main>
    </div>
  );
}
