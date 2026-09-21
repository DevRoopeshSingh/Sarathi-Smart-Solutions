"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRecord, ProjectRecord } from "@/server/dal";
import { createProjectAction, updateProjectStatusAction } from "../actions";

interface ProjectsManagerProps {
  initialProjects: ProjectRecord[];
  customers: CustomerRecord[];
}

const ALL_STATUS_OPTIONS = [
  { value: "SURVEY_PENDING", label: "Survey Pending" },
  { value: "SURVEY_COMPLETE", label: "Survey Complete" },
  { value: "COSTING", label: "Costing" },
  { value: "PROCUREMENT", label: "Procurement" },
  { value: "INSTALLATION_SCHEDULED", label: "Installation Scheduled" },
  { value: "INSTALLATION_IN_PROGRESS", label: "Installation in Progress" },
  { value: "TESTING", label: "Testing & QA" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" }
];

const LIFECYCLE_TABS = [
  { id: "ALL", label: "All", dotColor: "var(--primary)" },
  { id: "SURVEY_PENDING", label: "Survey Pending", dotColor: "#B45309" },
  { id: "COSTING", label: "Costing", dotColor: "#0E7490" },
  { id: "INSTALLATION_IN_PROGRESS", label: "Installation in Progress", dotColor: "#0369A1" },
  { id: "COMPLETED", label: "Completed", dotColor: "#15803D" }
];

function getNextMilestone(status: string): string {
  switch (status) {
    case "SURVEY_PENDING":
      return "Schedule Site Survey";
    case "SURVEY_COMPLETE":
      return "Compile Survey Measurements";
    case "COSTING":
      return "Prepare BOM & Quote";
    case "PROCUREMENT":
      return "Source Hardware & Cables";
    case "INSTALLATION_SCHEDULED":
      return "Dispatch Field Technicians";
    case "INSTALLATION_IN_PROGRESS":
      return "Wiring & Device Setup";
    case "TESTING":
      return "Signal & Quality Sign-off";
    case "COMPLETED":
      return "Handover Complete";
    case "CANCELLED":
      return "Project Closed";
    default:
      return "Follow-up Required";
  }
}

function getStatusBadgeClass(status: string): string {
  return `badge-${status.toLowerCase()}`;
}

export function ProjectsManager({ initialProjects, customers }: ProjectsManagerProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>(initialProjects);
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<string>("ALL");
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [showQuotationInfoModal, setShowQuotationInfoModal] = useState<boolean>(false);
  const [selectedProjectForView, setSelectedProjectForView] = useState<ProjectRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Sync with prop if updated
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  // Modal keyboard listeners (Escape key)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowNewModal(false);
        setShowQuotationInfoModal(false);
        setSelectedProjectForView(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Summary counts calculated genuinely from active records
  const metrics = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.operationalStatus !== "COMPLETED" && p.operationalStatus !== "CANCELLED").length;
    const surveysDue = projects.filter((p) => p.operationalStatus === "SURVEY_PENDING").length;
    const installationsInProgress = projects.filter((p) => p.operationalStatus === "INSTALLATION_IN_PROGRESS").length;
    const completed = projects.filter((p) => p.operationalStatus === "COMPLETED").length;
    return { total, active, surveysDue, installationsInProgress, completed };
  }, [projects]);

  // Dynamic counts for each lifecycle filter tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: projects.length,
      SURVEY_PENDING: projects.filter((p) => p.operationalStatus === "SURVEY_PENDING").length,
      COSTING: projects.filter((p) => p.operationalStatus === "COSTING").length,
      INSTALLATION_IN_PROGRESS: projects.filter((p) => p.operationalStatus === "INSTALLATION_IN_PROGRESS").length,
      COMPLETED: projects.filter((p) => p.operationalStatus === "COMPLETED").length
    };
    return counts;
  }, [projects]);

  // Filtered and searched list
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesFilter = filter === "ALL" || p.operationalStatus === filter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        p.name.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.siteAddress.toLowerCase().includes(q) ||
        (p.scope && p.scope.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [projects, filter, search]);

  async function handleCreateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const formData = new FormData(e.currentTarget);
    const result = await createProjectAction(formData);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setShowNewModal(false);
      window.location.reload();
    }
  }

  async function handleStatusChange(projectId: number, newStatus: string) {
    setUpdatingId(projectId);
    try {
      await updateProjectStatusAction(projectId, newStatus);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, operationalStatus: newStatus } : p))
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="admin-view">
      {/* Operational Summary Section (Calculated live from real records) */}
      <section className="ops-metrics-grid" aria-label="Operational Summary">
        <button
          type="button"
          className="ops-metric-card"
          onClick={() => setFilter("ALL")}
          title="Show all projects"
        >
          <div className="ops-metric-top">
            <span className="ops-metric-label">Active Projects</span>
            <div className="ops-metric-icon active-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
          </div>
          <div className="ops-metric-value">{metrics.active}</div>
          <div className="ops-metric-subtext">
            <span>{metrics.total} total recorded in system</span>
          </div>
        </button>

        <button
          type="button"
          className="ops-metric-card"
          onClick={() => setFilter("SURVEY_PENDING")}
          title="Filter by Survey Pending"
        >
          <div className="ops-metric-top">
            <span className="ops-metric-label">Surveys Due</span>
            <div className="ops-metric-icon survey-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
          <div className="ops-metric-value">{metrics.surveysDue}</div>
          <div className="ops-metric-subtext">
            <span>Awaiting initial site inspection</span>
          </div>
        </button>

        <button
          type="button"
          className="ops-metric-card"
          onClick={() => setFilter("INSTALLATION_IN_PROGRESS")}
          title="Filter by Installation in Progress"
        >
          <div className="ops-metric-top">
            <span className="ops-metric-label">Installations in Progress</span>
            <div className="ops-metric-icon install-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
          </div>
          <div className="ops-metric-value">{metrics.installationsInProgress}</div>
          <div className="ops-metric-subtext">
            <span>Field teams actively deployed</span>
          </div>
        </button>

        <button
          type="button"
          className="ops-metric-card"
          onClick={() => setFilter("COMPLETED")}
          title="Filter by Completed"
        >
          <div className="ops-metric-top">
            <span className="ops-metric-label">Completed Projects</span>
            <div className="ops-metric-icon completed-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="ops-metric-value">{metrics.completed}</div>
          <div className="ops-metric-subtext">
            <span>Successfully installed & handed over</span>
          </div>
        </button>
      </section>

      {/* Toolbar & Action Controls */}
      <div className="admin-toolbar">
        <div className="toolbar-search">
          <svg className="search-icon-inside" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search projects by title, customer, or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
            aria-label="Search projects"
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearch("")}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          {/* Secondary Action: Create from Quotation (Pending backend quotation conversion) */}
          <button
            type="button"
            onClick={() => setShowQuotationInfoModal(true)}
            className="admin-btn admin-btn-secondary"
            title="Create project from an existing quotation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <span>Create from Quotation</span>
          </button>

          {/* Primary Action: Create New Project */}
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              setShowNewModal(true);
            }}
            className="admin-btn admin-btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create New Project</span>
          </button>
        </div>
      </div>

      {/* Lifecycle Filter Tabs with Title Case & Real Counts */}
      <div className="filter-pills-wrap" role="region" aria-label="Lifecycle filters">
        <div className="filter-pills">
          {LIFECYCLE_TABS.map((tab) => {
            const isActive = filter === tab.id;
            const count = tabCounts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                className={`filter-pill ${isActive ? "active" : ""}`}
                onClick={() => setFilter(tab.id)}
                aria-pressed={isActive}
              >
                <span
                  className="filter-pill-dot"
                  style={{ backgroundColor: tab.dotColor }}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                <span className="filter-count-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State 1: When no projects exist in the entire database */}
      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrap" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <h3>No projects yet</h3>
          <p>
            Create a project manually or start from an approved quotation to track survey, costing,
            procurement, installation, and handover.
          </p>
          <div className="empty-state-actions">
            <button
              type="button"
              onClick={() => {
                setErrorMessage("");
                setShowNewModal(true);
              }}
              className="admin-btn admin-btn-primary"
            >
              + Create Project
            </button>
            <button
              type="button"
              onClick={() => setShowQuotationInfoModal(true)}
              className="admin-btn admin-btn-secondary"
            >
              Create from Quotation
            </button>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        /* Empty State 2: When records exist but query or filter returns zero matches */
        <div className="empty-state">
          <div className="empty-state-icon-wrap" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3>No projects match your filters</h3>
          <p>
            {search ? (
              <>No active projects matching <strong>&ldquo;{search}&rdquo;</strong> in stage <strong>{LIFECYCLE_TABS.find(t => t.id === filter)?.label || filter}</strong>.</>
            ) : (
              <>No projects currently found in stage <strong>{LIFECYCLE_TABS.find(t => t.id === filter)?.label || filter}</strong>.</>
            )}
            {" "}Try clearing filters to view all records.
          </p>
          <div className="empty-state-actions">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilter("ALL");
              }}
              className="admin-btn admin-btn-secondary"
            >
              Clear Search & Filters
            </button>
          </div>
        </div>
      ) : (
        /* Records exist: Render Desktop Table + Mobile Cards */
        <>
          {/* Desktop Table View */}
          <div className="table-card">
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Customer</th>
                    <th>Site Address</th>
                    <th>Current Stage</th>
                    <th>Assigned Team</th>
                    <th>Next Milestone</th>
                    <th>Started</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => {
                    const badgeClass = getStatusBadgeClass(p.operationalStatus);
                    const milestone = getNextMilestone(p.operationalStatus);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="project-title-cell">
                            <button
                              type="button"
                              onClick={() => setSelectedProjectForView(p)}
                              className="project-title-link"
                              style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
                            >
                              {p.name}
                            </button>
                            <div className="project-id-tag">#PRJ-{String(p.id).padStart(4, "0")}</div>
                            {p.scope && <div className="table-notes">{p.scope}</div>}
                          </div>
                        </td>
                        <td>
                          <div className="customer-name-bold">{p.customerName}</div>
                        </td>
                        <td>
                          <div className="site-address-cell">{p.siteAddress}</div>
                        </td>
                        <td>
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <select
                              value={p.operationalStatus}
                              disabled={updatingId === p.id}
                              onChange={(e) => handleStatusChange(p.id, e.target.value)}
                              className={`status-select status-badge ${badgeClass}`}
                              aria-label={`Update operational stage for project ${p.name}`}
                            >
                              {ALL_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <span className="table-subtext" title="Technicians are deployed according to the current operational milestone">
                            Operations Team
                          </span>
                        </td>
                        <td>
                          <span className="milestone-badge">{milestone}</span>
                        </td>
                        <td className="table-subtext" style={{ whiteSpace: "nowrap" }}>
                          {p.createdAt}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedProjectForView(p)}
                            className="admin-btn-action"
                            title="Inspect project details"
                          >
                            <span>View</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View (displayed below 1024px) */}
          <div className="mobile-cards-list">
            {filteredProjects.map((p) => {
              const badgeClass = getStatusBadgeClass(p.operationalStatus);
              const milestone = getNextMilestone(p.operationalStatus);
              return (
                <article key={p.id} className="mobile-project-card">
                  <div className="mobile-card-header">
                    <div>
                      <h4 className="mobile-card-title">{p.name}</h4>
                      <div className="mobile-card-customer">{p.customerName}</div>
                    </div>
                    <span className="project-id-tag">#PRJ-{String(p.id).padStart(4, "0")}</span>
                  </div>

                  <div className="mobile-card-address">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{p.siteAddress}</span>
                  </div>

                  {p.scope && <div className="mobile-card-scope">{p.scope}</div>}

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                      CURRENT STAGE
                    </label>
                    <select
                      value={p.operationalStatus}
                      disabled={updatingId === p.id}
                      onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      className={`status-select status-badge ${badgeClass}`}
                      style={{ width: "100%" }}
                    >
                      {ALL_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mobile-card-footer">
                    <div>
                      <span className="milestone-badge">{milestone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectForView(p)}
                      className="admin-btn-action"
                    >
                      View Details →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Modal 1: Create New Project */}
      {showNewModal && (
        <div className="modal-backdrop" onClick={() => setShowNewModal(false)}>
          <div
            className="modal-dialog"
            role="dialog"
            aria-labelledby="create-modal-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="create-modal-title">Create New Project</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowNewModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="modal-form">
              {errorMessage && <div className="form-error-banner" role="alert">{errorMessage}</div>}

              <div className="form-group">
                <label htmlFor="customerId">Select Customer *</label>
                <select id="customerId" name="customerId" required className="admin-input">
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="name">Project Name / Title *</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. 4-Cam Security & Wi-Fi Setup"
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
                  placeholder="e.g. Flat 301, Royal Tower, Mira Road, Mumbai"
                  className="admin-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="scope">Initial Scope of Work</label>
                <textarea
                  id="scope"
                  name="scope"
                  rows={3}
                  placeholder="e.g. Install 4 IP cameras, 4-channel NVR, 1TB HDD, route CAT6 casing, configure mobile app access"
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
                  {isSubmitting ? "Creating..." : "Save Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create from Quotation Workflow Helper Modal */}
      {showQuotationInfoModal && (
        <div className="modal-backdrop" onClick={() => setShowQuotationInfoModal(false)}>
          <div
            className="modal-dialog"
            role="dialog"
            aria-labelledby="quotation-workflow-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="quotation-workflow-title">Create from Quotation</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowQuotationInfoModal(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-form">
              <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--accent-tint)",
                    color: "var(--accent)",
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 16px"
                  }}
                  aria-hidden="true"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h4 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 8px", color: "var(--primary)" }}>
                  Operational Workflow Architecture
                </h4>
                <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6, margin: "0 auto", maxWidth: "440px" }}>
                  In Sarathi&apos;s workflow, quotations are prepared from site survey findings and BOM costings linked to active projects.
                  To convert an approved quote or create a new installation:
                </p>
              </div>

              <div style={{ background: "var(--surface-subtle)", border: "1px solid var(--line)", borderRadius: "6px", padding: "16px", marginBottom: "20px" }}>
                <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "var(--ink)", lineHeight: 1.6 }}>
                  <li>Create or select an active project for your customer.</li>
                  <li>Perform the site survey and record measurements.</li>
                  <li>Generate a commercial quote with version control.</li>
                </ol>
              </div>

              <div className="modal-footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Link href="/admin/quotes" className="admin-btn admin-btn-secondary" onClick={() => setShowQuotationInfoModal(false)}>
                  View All Quotations →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuotationInfoModal(false);
                    setShowNewModal(true);
                  }}
                  className="admin-btn admin-btn-primary"
                >
                  + Create Project Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: View Project Details Drawer/Dialog */}
      {selectedProjectForView && (
        <div className="modal-backdrop" onClick={() => setSelectedProjectForView(null)}>
          <div
            className="modal-dialog"
            role="dialog"
            aria-labelledby="view-project-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow" style={{ color: "var(--accent)" }}>
                  #PRJ-{String(selectedProjectForView.id).padStart(4, "0")}
                </span>
                <h3 id="view-project-title" style={{ marginTop: "4px" }}>
                  {selectedProjectForView.name}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedProjectForView(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-form">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Customer</span>
                  <span className="detail-val">{selectedProjectForView.customerName}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Current Stage</span>
                  <div>
                    <span className={`status-badge ${getStatusBadgeClass(selectedProjectForView.operationalStatus)}`}>
                      {ALL_STATUS_OPTIONS.find((s) => s.value === selectedProjectForView.operationalStatus)?.label ||
                        selectedProjectForView.operationalStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                  <span className="detail-label">Site Address</span>
                  <span className="detail-val">{selectedProjectForView.siteAddress}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                  <span className="detail-label">Scope of Work</span>
                  <div style={{ background: "var(--surface-subtle)", border: "1px solid var(--line)", padding: "12px", borderRadius: "4px", fontSize: "13px", color: "var(--ink)", lineHeight: 1.5, marginTop: "4px" }}>
                    {selectedProjectForView.scope || "No specific scope notes provided."}
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Next Milestone</span>
                  <span className="detail-val">{getNextMilestone(selectedProjectForView.operationalStatus)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Created Date</span>
                  <span className="detail-val">{selectedProjectForView.createdAt}</span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link href="/admin/quotes" className="admin-btn admin-btn-action" onClick={() => setSelectedProjectForView(null)}>
                  Check Quotations →
                </Link>
                <Link href="/admin/payments" className="admin-btn admin-btn-action" onClick={() => setSelectedProjectForView(null)}>
                  Audit Payments →
                </Link>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setSelectedProjectForView(null)}
                  className="admin-btn admin-btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
