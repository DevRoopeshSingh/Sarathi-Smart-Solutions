"use client";

import { useState } from "react";
import type { CustomerRecord } from "@/server/dal";
import { createCustomerAction } from "../actions";

interface CustomersManagerProps {
  initialCustomers: CustomerRecord[];
}

export function CustomersManager({ initialCustomers }: CustomersManagerProps) {
  const [customers] = useState(initialCustomers);
  const [search, setSearch] = useState<string>("");
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const filteredCustomers = customers.filter(
    (c) =>
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleCreateCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(e.currentTarget);
    const result = await createCustomerAction(formData);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setShowNewModal(false);
      window.location.reload();
    }
  }

  return (
    <div className="admin-view">
      <div className="admin-toolbar">
        <div className="toolbar-search">
          <input
            type="search"
            placeholder="Search customers by name, phone, or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-input search-input"
          />
        </div>
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
                  <td className="table-subtext">{c.createdAt}</td>
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
              {errorMessage && <div className="form-error-banner">{errorMessage}</div>}
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
