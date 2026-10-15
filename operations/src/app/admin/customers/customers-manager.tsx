"use client";
import { formatIndiaDate } from "@/lib/date";
import Link from "next/link";
import { CustomerForm, CustomerDialog } from "./customer-form";
import { ListSearch, useListFilters } from "../list-controls";

import { useEffect, useState } from "react";
import type { CustomerRecord } from "@/lib/operations";
import { useRouter, useSearchParams } from "next/navigation";

interface CustomersManagerProps {
  initialCustomers: CustomerRecord[];
  canWrite: boolean;
}

export function CustomersManager({ initialCustomers, canWrite }: CustomersManagerProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  useEffect(() => setCustomers(initialCustomers), [initialCustomers]);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [saved, setSaved] = useState(false);
  const filters = useListFilters();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!canWrite || searchParams.get("new") !== "1") return;
    setShowNewModal(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    router.replace(url.pathname + url.search + url.hash, { scroll: false });
  }, [canWrite, searchParams, router]);

  const filteredCustomers = customers;

  return (
    <div className="admin-view">
      <div className="admin-toolbar">
        <ListSearch placeholder="Search customers by name, phone, email, or address..." />
        {canWrite && (
          <div className="toolbar-actions">
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="admin-btn admin-btn-primary"
            >
              + Add New Customer
            </button>
          </div>
        )}
      </div>

      <p role="status">{saved ? "Customer saved." : ""}</p>
      <label>
        Project filter{" "}
        <select
          className="admin-input"
          value={filters.filter}
          onChange={(event) => filters.setFilter(event.target.value)}
        >
          <option value="ALL">All customers</option>
          <option value="HAS_PROJECTS">With visible projects</option>
          <option value="NO_PROJECTS">Without visible projects</option>
        </select>
      </label>
      {filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <p>No customer profiles found.</p>
          {canWrite && (
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="admin-btn admin-btn-small"
            >
              + Add Customer
            </button>
          )}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Email Address</th>
                <th>Address / Location</th>
                <th>Projects</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/customers/${c.id}`}>
                      <strong>{c.name}</strong>
                    </Link>
                  </td>
                  <td>
                    <a href={`tel:${c.phone}`} className="phone-link">
                      {c.phone}
                    </a>
                  </td>
                  <td>{c.email ? c.email : <span className="muted">—</span>}</td>
                  <td>{c.address ? c.address : <span className="muted">—</span>}</td>
                  <td>
                    <span className="count-pill">{c.projectCount} projects</span>
                  </td>
                  <td className="table-subtext">{formatIndiaDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canWrite && showNewModal && (
        <CustomerDialog title="Create Customer Profile" onClose={() => setShowNewModal(false)}>
          <CustomerForm onClose={() => setShowNewModal(false)} onSaved={() => setSaved(true)} />
        </CustomerDialog>
      )}
    </div>
  );
}
