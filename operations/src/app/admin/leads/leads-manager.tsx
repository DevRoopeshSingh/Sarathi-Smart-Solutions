"use client";

import { useState } from "react";
import type { CustomerRecord, LeadRecord } from "@/server/dal";
import { createLeadAction, createProjectAction, updateLeadStatusAction } from "../actions";

interface LeadsManagerProps {
  initialLeads: LeadRecord[];
  customers: CustomerRecord[];
}

export function LeadsManager({ initialLeads, customers }: LeadsManagerProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [convertingLead, setConvertingLead] = useState<LeadRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const filteredLeads = leads.filter((lead) => {
    const matchesFilter = filter === "ALL" || lead.status === filter;
    const matchesSearch =
      search === "" ||
      lead.contactName.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone.includes(search) ||
      lead.serviceRequested.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  async function handleCreateLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(e.currentTarget);
    const result = await createLeadAction(formData);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setShowNewModal(false);
      window.location.reload();
    }
  }

  async function handleStatusChange(leadId: number, newStatus: string) {
    await updateLeadStatusAction(leadId, newStatus);
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStatus as LeadRecord["status"] } : lead
      )
    );
  }

  async function handleConvertProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!convertingLead) return;
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(e.currentTarget);
    formData.append("leadId", String(convertingLead.id));
    const result = await createProjectAction(formData);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setConvertingLead(null);
      window.location.href = "/admin/projects";
    }
  }

  return (
    <div className="admin-view">
      <div className="admin-toolbar">
        <div className="toolbar-search">
          <input
            type="search"
            placeholder="Search leads by name, phone, or service..."
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
            + Add New Lead
          </button>
        </div>
      </div>

      <div className="filter-pills flex flex-wrap gap-3 mb-6" role="group" aria-label="Filter leads by status">
        {["ALL", "NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"].map((status) => (
          <button
            key={status}
            type="button"
            className={`filter-pill ${filter === status ? "active" : ""}`}
            onClick={() => setFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {filteredLeads.length === 0 ? (
        <div className="empty-state">
          <p>No leads found matching your filter.</p>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="admin-btn admin-btn-small"
          >
            + Add Lead
          </button>
        </div>
      ) : (
        <div className="leads-table-card">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Service Requested</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <strong>{lead.contactName}</strong>
                      <div className="table-subtext">
                        <a href={`tel:${lead.phone}`} className="phone-link">
                          {lead.phone}
                        </a>
                      </div>
                    </td>
                    <td>
                      <span>{lead.serviceRequested}</span>
                      {lead.notes && <div className="table-notes">{lead.notes}</div>}
                    </td>
                    <td>
                      <span className="source-tag">{lead.source}</span>
                    </td>
                    <td>
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className={`status-select badge-${lead.status.toLowerCase()}`}
                      >
                        <option value="NEW">NEW</option>
                        <option value="CONTACTED">CONTACTED</option>
                        <option value="QUALIFIED">QUALIFIED</option>
                        <option value="CONVERTED">CONVERTED</option>
                        <option value="LOST">LOST</option>
                      </select>
                    </td>
                    <td className="table-subtext">{lead.createdAt}</td>
                    <td>
                      {lead.status !== "CONVERTED" && (
                        <button
                          type="button"
                          onClick={() => setConvertingLead(lead)}
                          className="admin-btn-action"
                          title="Convert into an active project"
                        >
                          Convert to Project →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewModal && (
        <div className="modal-backdrop" onClick={() => setShowNewModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Lead</h3>
              <button type="button" className="modal-close" onClick={() => setShowNewModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateLead} className="modal-form">
              {errorMessage && <div className="form-error-banner">{errorMessage}</div>}
              <div className="form-group">
                <label htmlFor="contactName">Customer / Contact Name *</label>
                <input
                  id="contactName"
                  name="contactName"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Mobile Phone Number *</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="e.g. 9820098200"
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="serviceRequested">Service Requested *</label>
                <input
                  id="serviceRequested"
                  name="serviceRequested"
                  type="text"
                  required
                  placeholder="e.g. CCTV 4 Camera installation"
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="source">Lead Source</label>
                <select id="source" name="source" className="admin-input">
                  <option value="WEBSITE">Website Enquiry</option>
                  <option value="PHONE">Direct Phone Call</option>
                  <option value="WHATSAPP">WhatsApp Message</option>
                  <option value="REFERRAL">Customer Referral</option>
                  <option value="MANUAL">Manual Walk-in</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="notes">Notes / Site Details</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="e.g. 2 BHK apartment in Bhayandar East, wants mobile viewing"
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
                  {isSubmitting ? "Creating..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {convertingLead && (
        <div className="modal-backdrop" onClick={() => setConvertingLead(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Convert Lead to Project</h3>
              <button type="button" className="modal-close" onClick={() => setConvertingLead(null)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleConvertProject} className="modal-form">
              {errorMessage && <div className="form-error-banner">{errorMessage}</div>}
              <p className="lead-copy">
                Converting enquiry from <strong>{convertingLead.contactName}</strong> (
                {convertingLead.phone}).
              </p>
              <div className="form-group">
                <label htmlFor="customerId">Assign to Customer *</label>
                <select id="customerId" name="customerId" required className="admin-input">
                  <option value="">-- Choose existing customer or create first --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
                <div className="input-hint">
                  Need a new customer?{" "}
                  <a href="/admin/customers?new=1" target="_blank">
                    Add customer first ↗
                  </a>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="projectName">Project Title *</label>
                <input
                  id="projectName"
                  name="name"
                  type="text"
                  required
                  defaultValue={`${convertingLead.contactName} - ${convertingLead.serviceRequested}`}
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="siteAddress">Site Address *</label>
                <input
                  id="siteAddress"
                  name="siteAddress"
                  type="text"
                  required
                  placeholder="e.g. Flat 402, Shanti Park, Bhayandar East"
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="scope">Initial Scope / Requirements</label>
                <textarea
                  id="scope"
                  name="scope"
                  rows={3}
                  defaultValue={convertingLead.notes || convertingLead.serviceRequested}
                  className="admin-input"
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setConvertingLead(null)}
                  className="admin-btn admin-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="admin-btn admin-btn-primary"
                >
                  {isSubmitting ? "Converting..." : "Confirm & Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
