import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminActor, getCustomers } from "@/server/dal";
import { CustomersManager } from "./customers-manager";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const requestHeaders = await headers();
  if (!(await getAdminActor(requestHeaders))) redirect("/admin/login");

  const customers = await getCustomers(requestHeaders);

  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <section className="workspace-heading">
          <span className="eyebrow">
            <span className="small-rule" />
            CLIENT DIRECTORY
          </span>
          <h1>Customer Accounts</h1>
          <p className="lead-copy">
            Maintain customer contact details, premises locations, and linked project histories.
          </p>
        </section>

        <CustomersManager initialCustomers={customers} />
      </main>
    </div>
  );
}
