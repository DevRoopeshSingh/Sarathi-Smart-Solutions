import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAdminActor } from "@/server/dal";
import { getCustomerProfile, CUSTOMER_SECTIONS } from "@/server/customers";
import type { SearchParameters } from "@/server/lists";
import { formatIndiaDate } from "@/lib/date";
import { getProjectServiceLabel } from "@/lib/project-services";
import { AccessDeniedError, InputError } from "@/server/mutation-errors";
import { CustomerEditor } from "../customer-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Customer profile" };
export default async function CustomerPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParameters>;
}) {
  const requestHeaders = await headers();
  if (!(await getAdminActor(requestHeaders))) redirect("/admin/login");
  const { id } = await params;
  if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) notFound();
  const query = await searchParams;
  const profile = await getCustomerProfile(requestHeaders, id, query).catch((error) => {
    if (error instanceof InputError) redirect(`/admin/customers/${id}`);
    if (error instanceof AccessDeniedError) redirect("/admin");
    throw error;
  });
  if (!profile) notFound();
  const { customer, items, section, next } = profile;
  const base = `/admin/customers/${customer.id}`;
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main customer-profile">
        <Link href="/admin/customers">← Customer accounts</Link>
        <section className="workspace-heading">
          <span className="eyebrow">CUSTOMER PROFILE</span>
          <h1>{customer.name}</h1>
          <p className="lead-copy">Contact details and records available to your divisions.</p>
        </section>
        <section aria-label="Customer information" className="workflow-card">
          <dl className="customer-contact-grid">
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${customer.phone}`}>{customer.phone}</a>
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                {customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : "—"}
              </dd>
            </div>
            <div>
              <dt>Address / Locality</dt>
              <dd>{customer.address || "—"}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{formatIndiaDate(customer.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatIndiaDate(customer.updatedAt)}</dd>
            </div>
          </dl>
          <CustomerEditor customer={customer} canEdit={profile.canEdit} />
        </section>
        <nav aria-label="Customer records" className="customer-tabs">
          {CUSTOMER_SECTIONS.filter((value) => value !== "payments" || profile.canReadPayments).map(
            (value) => (
              <Link
                key={value}
                href={`${base}?section=${value}`}
                aria-current={section === value ? "page" : undefined}
              >
                {value === "activity"
                  ? "Recent activity"
                  : value === "quotes"
                    ? "Quotations"
                    : value.charAt(0).toUpperCase() + value.slice(1)}
              </Link>
            )
          )}
        </nav>
        <section aria-label={`${section} records`}>
          <h2>
            {section === "activity"
              ? "Recent activity"
              : section.charAt(0).toUpperCase() + section.slice(1)}
          </h2>
          {items.length === 0 ? (
            <p>No records available in this section.</p>
          ) : (
            <ul className="customer-record-list">
              {items.map((record) => {
                const link =
                  section === "projects"
                    ? `/admin/projects/${record.id}`
                    : section === "leads"
                      ? `/admin/leads/${record.id}`
                      : section === "quotes"
                        ? `/admin/quotes/${record.id}`
                        : section === "payments"
                          ? `/admin/payments/${record.id}`
                          : null;
                return (
                  <li key={`${record.source}:${record.id}`}>
                    <h3>{link ? <Link href={link}>{record.title}</Link> : record.title}</h3>
                    <p>
                      {record.status.replaceAll("_", " ")}
                      {record.division && ` · ${record.division}`}
                    </p>
                    {record.services.length > 0 && (
                      <p>Services: {record.services.map(getProjectServiceLabel).join(", ")}</p>
                    )}
                    {record.detail && <p>{record.detail}</p>}
                    <p className="table-subtext">
                      {formatIndiaDate(record.at)}
                      {record.actor && ` · ${record.actor}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <nav aria-label="Customer record pages">
            <span>Up to 25 records per page. </span>
            {query.after && <Link href={`${base}?section=${section}`}>First page</Link>}
            {next && <Link href={`${base}?section=${section}&after=${next}`}>Next page →</Link>}
          </nav>
        </section>
      </main>
    </div>
  );
}
