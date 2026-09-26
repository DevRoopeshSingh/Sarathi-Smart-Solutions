"use client";
import { formatIndiaDate } from "@/lib/date";
import { CustomerSelect } from "../customer-select";
import { ListSearch, useListFilters } from "../list-controls";

import { useEffect, useRef, useState } from "react";
import type { CustomerOption, LeadRecord } from "@/lib/operations";
import { useRouter, useSearchParams } from "next/navigation";
import { createLeadAction, createProjectAction, updateLeadStatusAction } from "../actions";

interface LeadsManagerProps {
  initialLeads: LeadRecord[];
  customers: CustomerOption[];
}

export function LeadsManager({ initialLeads, customers }: LeadsManagerProps) {
  const { filter, setFilter } = useListFilters();
  const [leads, setLeads] = useState(initialLeads);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [convertingLead, setConvertingLead] = useState<LeadRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const submittingRef = useRef(false);
  const updatingRef = useRef(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setShowNewModal(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    router.replace(url.pathname + url.search + url.hash, { scroll: false });
  }, [searchParams, router]);

  useEffect(() => setLeads(initialLeads), [initialLeads]);

  const filteredLeads = leads;

  async function handleCreateLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(e.currentTarget);
    try {
      const result = await createLeadAction(formData);
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

  async function handleStatusChange(leadId: string, newStatus: string) {
    if (updatingRef.current) return;
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.status === newStatus) return;
    updatingRef.current = true;
    setUpdatingId(leadId);
    setStatusError("");
    try {
      const result = await updateLeadStatusAction(leadId, newStatus, lead.status);
      if ("error" in result) {
        setStatusError(result.error ?? "Unable to update the status. Please try again.");
        return;
      }
      setLeads((prev) =>
        prev.map((item) =>
          item.id === leadId ? { ...item, status: newStatus as LeadRecord["status"] } : item
        )
      );
    } catch {
      setStatusError(
        "Unable to confirm the status change. Reload to check the latest status before retrying."
      );
    } finally {
      updatingRef.current = false;
      setUpdatingId(null);
    }
  }

  async function handleConvertProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!convertingLead || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(e.currentTarget);
    formData.append("leadId", convertingLead.id);
    try {
      const result = await createProjectAction(formData);
      if ("error" in result) {
        setErrorMessage(result.error ?? "Unable to save. Please try again.");
        return;
      }
      setConvertingLead(null);
      router.push("/admin/projects");
    } catch {
      setErrorMessage(
        "Unable to confirm the conversion. Reload to check the lead before retrying."
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-view">
      <div className="admin-toolbar">
        <ListSearch placeholder="Search leads by name, phone, or service..." />
        <div className="toolbar-actions">
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setShowNewModal(true);
            }}
            className="admin-btn admin-btn-primary"
          >
            + Add New Lead
          </button>
        </div>
      </div>

      <div
        className="filter-pills flex flex-wrap gap-3 mb-6"
        role="group"
        aria-label="Filter leads by status"
      >
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

      {statusError && (
        <p className="form-error-banner" role="alert">
          {statusError}
        </p>
      )}

      {filteredLeads.length === 0 ? (
        <div className="empty-state">
          <p>No leads found matching your filter.</p>
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setShowNewModal(true);
            }}
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
                        disabled={updatingId !== null || lead.status === "CONVERTED"}
                        aria-label={`Update status for ${lead.contactName}`}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className={`status-select badge-${lead.status.toLowerCase()}`}
                      >
                        <option value="NEW">NEW</option>
                        <option value="CONTACTED">CONTACTED</option>
                        <option value="QUALIFIED">QUALIFIED</option>
                        <option value="CONVERTED" disabled>
                          CONVERTED (via project)
                        </option>
                        <option value="LOST">LOST</option>
                      </select>
                    </td>
                    <td className="table-subtext">{formatIndiaDate(lead.createdAt)}</td>
                    <td>
                      {lead.status !== "CONVERTED" && (
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage("");
                            setConvertingLead(lead);
                          }}
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
              {errorMessage && (
                <div className="form-error-banner" role="alert">
                  {errorMessage}
                </div>
              )}
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
              {errorMessage && (
                <div className="form-error-banner" role="alert">
                  {errorMessage}
                </div>
              )}
              <p className="lead-copy">
                Converting enquiry from <strong>{convertingLead.contactName}</strong> (
                {convertingLead.phone}).
              </p>
              <div className="form-group">
                <CustomerSelect initial={customers} label="Assign to Customer *" />
                <div className="input-hint">
                  Need a new customer?{" "}
                  <a href="/admin/customers?new=1" target="_blank" rel="noopener noreferrer">
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
