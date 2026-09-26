import { formatIndiaDate } from "@/lib/date";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccessDeniedError, getAdminActor, getAdminOverview } from "@/server/dal";
import { SessionControls } from "./session-controls";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function formatServiceName(raw: string): string {
  if (!raw) return "General Consultation";
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes("4 camra") || lower.includes("4 camera")) return "CCTV – 4 Cameras";
  if (lower.includes("8 camra") || lower.includes("8 camera")) return "CCTV – 8 Cameras";
  if (lower.includes("16 camra") || lower.includes("16 camera")) return "CCTV – 16 Cameras";
  if (lower === "cctv") return "CCTV Surveillance";
  if (lower.includes("wifi") || lower.includes("wi-fi") || lower.includes("network"))
    return "Wi-Fi & Networking";
  if (lower.includes("intercom")) return "Video Intercom & VDP";
  if (lower.includes("biometric") || lower.includes("access control"))
    return "Biometric Access Control";
  if (lower.includes("automation") || lower.includes("smart home")) return "Smart Home Automation";
  if (lower.includes("fire") || lower.includes("alarm")) return "Fire & Safety Alarm";

  // Clean capitalize words if arbitrary string
  return trimmed
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatHumanDate(dateStr: string): string {
  return formatIndiaDate(dateStr);
}

function getProjectMilestone(status: string): string {
  switch (status) {
    case "SURVEY_PENDING":
      return "Schedule Site Visit";
    case "SURVEY_COMPLETE":
      return "Compile Measurements";
    case "COSTING":
      return "Prepare BOM & Quote";
    case "PROCUREMENT":
      return "Verify Material Readiness";
    case "INSTALLATION_SCHEDULED":
      return "Dispatch Field Technicians";
    case "INSTALLATION_IN_PROGRESS":
      return "Wiring & Setup";
    case "TESTING":
      return "Quality Audit & Sign-off";
    case "COMPLETED":
      return "Handover Complete";
    default:
      return "Stage Progress";
  }
}

export default async function AdminPage() {
  const requestHeaders = await headers();
  if (!(await getAdminActor(requestHeaders))) redirect("/admin/login");
  const overview = await getAdminOverview(requestHeaders).catch((error: unknown) => {
    if (error instanceof AccessDeniedError) redirect("/admin/login");
    throw error;
  });

  const { actor, counts, recentLeads, recentProjects } = overview;

  const initials = actor.displayName
    ? actor.displayName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        {/* Page Heading & Secondary Greeting */}
        <section className="workspace-heading">
          <span className="eyebrow">
            <span className="small-rule" />
            OPERATIONS SUITE
          </span>
          <h1>Live Operations</h1>
          <h2 className="welcome-heading">Welcome, {actor.displayName}.</h2>
          <p className="lead-copy">Live overview of your leads, customers, and active projects.</p>
        </section>

        {/* Quick Actions with Primary / Secondary Hierarchy */}
        <div className="quick-actions-bar" role="region" aria-label="Quick operations actions">
          <Link
            href="/admin/leads?new=1"
            className="admin-btn admin-btn-primary"
            title="Record incoming customer enquiry"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Lead</span>
          </Link>

          <Link
            href="/admin/customers?new=1"
            className="admin-btn admin-btn-secondary"
            title="Create customer profile directly"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span>New Customer</span>
          </Link>

          <Link
            href="/admin/projects?new=1"
            className="admin-btn admin-btn-secondary"
            title="Initiate a project directly"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>New Project</span>
          </Link>
        </div>

        {/* Business Overview Cards */}
        <section aria-labelledby="records-heading" className="records-section">
          <div className="section-heading">
            <h2 id="records-heading">Business Overview</h2>
            <span className="section-eyebrow-badge">Real-Time Totals</span>
          </div>

          <div className="metric-grid">
            <Link href="/admin/leads" className="metric" title="View all incoming leads">
              <div className="metric-top-row">
                <dt>Leads</dt>
                <div className="metric-icon-badge metric-icon-leads" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
              </div>
              <dd>{new Intl.NumberFormat("en-IN").format(counts.leads)}</dd>
              <div className="metric-footer">
                <span className="metric-context">Enquiries recorded</span>
                <span className="metric-link-hint">
                  View leads <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>

            <Link
              href="/admin/projects"
              className="metric"
              title="View active projects and installations"
            >
              <div className="metric-top-row">
                <dt>Projects</dt>
                <div className="metric-icon-badge metric-icon-projects" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
              </div>
              <dd>{new Intl.NumberFormat("en-IN").format(counts.projects)}</dd>
              <div className="metric-footer">
                <span className="metric-context">Operational pipeline</span>
                <span className="metric-link-hint">
                  View projects <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>

            <Link
              href="/admin/quotes"
              className="metric"
              title="View commercial quotations and estimates"
            >
              <div className="metric-top-row">
                <dt>Quotations</dt>
                <div className="metric-icon-badge metric-icon-quotes" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
              </div>
              <dd>{new Intl.NumberFormat("en-IN").format(counts.quotations)}</dd>
              <div className="metric-footer">
                <span className="metric-context">Commercial quotes</span>
                <span className="metric-link-hint">
                  View quotes <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          </div>
        </section>

        {/* Dashboard Split Grid: Recent Leads & Recent Projects */}
        <section className="admin-split-grid">
          {/* Card 1: Recent Leads */}
          <div className="admin-card">
            <div className="card-header-flex">
              <div>
                <span className="eyebrow card-eyebrow">Incoming Enquiries</span>
                <h3>Recent Leads</h3>
              </div>
              <Link href="/admin/leads" className="card-header-link">
                View all ({counts.leads}) →
              </Link>
            </div>

            {recentLeads.length === 0 ? (
              <div className="empty-state" style={{ padding: "36px 20px" }}>
                <div
                  className="empty-state-icon-wrap"
                  style={{ width: "48px", height: "48px", marginBottom: "12px" }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--primary)" }}>
                  No leads recorded yet
                </h4>
                <p style={{ margin: "0 0 16px", fontSize: "13px" }}>
                  Customer enquiries from the website or direct calls will appear here.
                </p>
                <Link
                  href="/admin/leads?new=1"
                  className="admin-btn admin-btn-small admin-btn-primary"
                >
                  + Add First Lead
                </Link>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Contact</th>
                        <th>Service Requested</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLeads.map((lead) => (
                        <tr key={lead.id}>
                          <td>
                            <strong>{lead.contactName}</strong>
                            <div
                              className="table-subtext"
                              style={{ display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              <span>{lead.phone}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 500 }}>
                              {formatServiceName(lead.serviceRequested)}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge badge-${lead.status.toLowerCase()}`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="table-subtext" style={{ whiteSpace: "nowrap" }}>
                            {formatHumanDate(lead.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacked View */}
                <div className="mobile-cards-list" style={{ marginTop: "8px" }}>
                  {recentLeads.map((lead) => (
                    <div key={lead.id} className="mobile-project-card" style={{ padding: "14px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start"
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "15px", color: "var(--primary)" }}>
                            {lead.contactName}
                          </strong>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}
                          >
                            {lead.phone}
                          </div>
                        </div>
                        <span className={`status-badge badge-${lead.status.toLowerCase()}`}>
                          {lead.status}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--ink)",
                          marginTop: "6px"
                        }}
                      >
                        {formatServiceName(lead.serviceRequested)}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                        {formatHumanDate(lead.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Card 2: Recent Projects */}
          <div className="admin-card">
            <div className="card-header-flex">
              <div>
                <span className="eyebrow card-eyebrow">Active Operations</span>
                <h3>Recent Projects</h3>
              </div>
              <Link href="/admin/projects" className="card-header-link">
                View all ({counts.projects}) →
              </Link>
            </div>

            {recentProjects.length === 0 ? (
              <div className="empty-state" style={{ padding: "36px 20px" }}>
                <div
                  className="empty-state-icon-wrap"
                  style={{ width: "48px", height: "48px", marginBottom: "12px" }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
                <h4 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--primary)" }}>
                  No projects yet
                </h4>
                <p style={{ margin: "0 0 16px", fontSize: "13px" }}>
                  Create a project to track site survey, costing, procurement, installation, and
                  handover.
                </p>
                <Link
                  href="/admin/projects?new=1"
                  className="admin-btn admin-btn-small admin-btn-primary"
                >
                  + Create Project
                </Link>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Project & Customer</th>
                        <th>Current Stage</th>
                        <th>Milestone</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentProjects.map((project) => (
                        <tr key={project.id}>
                          <td>
                            <strong>{project.name}</strong>
                            <div className="table-subtext">{project.customerName}</div>
                          </td>
                          <td>
                            <span
                              className={`status-badge badge-${project.operationalStatus.toLowerCase()}`}
                            >
                              {project.operationalStatus.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>
                            <span
                              className="milestone-badge"
                              style={{ fontSize: "11px", padding: "3px 8px" }}
                            >
                              {getProjectMilestone(project.operationalStatus)}
                            </span>
                          </td>
                          <td className="table-subtext" style={{ whiteSpace: "nowrap" }}>
                            {formatHumanDate(project.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacked View */}
                <div className="mobile-cards-list" style={{ marginTop: "8px" }}>
                  {recentProjects.map((project) => (
                    <div
                      key={project.id}
                      className="mobile-project-card"
                      style={{ padding: "14px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start"
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "15px", color: "var(--primary)" }}>
                            {project.name}
                          </strong>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}
                          >
                            {project.customerName}
                          </div>
                        </div>
                        <span
                          className={`status-badge badge-${project.operationalStatus.toLowerCase()}`}
                        >
                          {project.operationalStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <span
                          className="milestone-badge"
                          style={{ fontSize: "11px", padding: "3px 8px" }}
                        >
                          {getProjectMilestone(project.operationalStatus)}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>
                        {formatHumanDate(project.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Compact Account & Access Section */}
        <section className="account-card-compact" aria-labelledby="account-heading">
          <div className="account-info-group">
            <div className="account-avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="account-title-group">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 id="account-heading" style={{ margin: 0 }}>
                  Administrator Session
                </h3>
                <span className="account-role-badge">Administrator</span>
              </div>
              <p className="account-email" style={{ margin: "2px 0 0" }}>
                {actor.email}
              </p>
            </div>
          </div>
          <SessionControls />
        </section>
      </main>
    </div>
  );
}
