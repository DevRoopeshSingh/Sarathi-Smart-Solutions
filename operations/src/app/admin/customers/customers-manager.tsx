"use client";
import { formatIndiaDate } from "@/lib/date";
import { ListSearch } from "../list-controls";

import { useEffect, useRef, useState } from "react";
import type { CustomerRecord } from "@/lib/operations";
import { useRouter, useSearchParams } from "next/navigation";
import { createCustomerAction } from "../actions";

interface CustomersManagerProps {
  initialCustomers: CustomerRecord[];
}

export function CustomersManager({ initialCustomers }: CustomersManagerProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  useEffect(() => setCustomers(initialCustomers), [initialCustomers]);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const submittingRef = useRef(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setShowNewModal(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    router.replace(url.pathname + url.search + url.hash, { scroll: false });
  }, [searchParams, router]);

  const filteredCustomers = customers;

  async function handleCreateCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(e.currentTarget);
    try {
      const result = await createCustomerAction(formData);
      if ("error" in result) {
        setErrorMessage(result.error ?? "Unable to save. Please try again.");
        return;
      }
      setShowNewModal(false);
      router.refresh();
    } catch {
      setErrorMessage(
        "Unable to confirm the save. Check your connection and reload before retrying."
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-view">
      <div className="admin-toolbar">
        <ListSearch placeholder="Search customers by name, phone, or address..." />
        <div className="toolbar-actions">
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="admin-btn admin-btn-primary"
          >
            + Add New Customer
          </button>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <p>No customer profiles found.</p>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="admin-btn admin-btn-small"
          >
            + Add Customer
          </button>
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
                    <strong>{c.name}</strong>
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

      {showNewModal && (
        <div className="modal-backdrop" onClick={() => setShowNewModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Customer Profile</h3>
              <button type="button" className="modal-close" onClick={() => setShowNewModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="modal-form">
              {errorMessage && (
                <div className="form-error-banner" role="alert">
                  {errorMessage}
                </div>
              )}
              <div className="form-group">
                <label htmlFor="customerName">Full Name / Business Name *</label>
                <input
                  id="customerName"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Rajesh Mehra"
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="customerPhone">Mobile Number *</label>
                <input
                  id="customerPhone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="e.g. 9820098200"
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="customerEmail">Email Address (Optional)</label>
                <input
                  id="customerEmail"
                  name="email"
                  type="email"
                  placeholder="e.g. rajesh@example.com"
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="customerAddress">Address / Locality (Optional)</label>
                <textarea
                  id="customerAddress"
                  name="address"
                  rows={2}
                  placeholder="e.g. Shop 4, Silver Plaza, Mira Road"
                  className="admin-input"
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="admin-btn admin-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="admin-btn admin-btn-primary"
                >
                  {isSubmitting ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
