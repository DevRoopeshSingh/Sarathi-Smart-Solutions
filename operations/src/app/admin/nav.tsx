"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

interface AdminNavProps {
  displayName: string;
  email: string;
  publicSiteUrl?: string;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/security",
    label: "Account security",
    icon: () => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    )
  },
  {
    href: "/admin",
    label: "Dashboard",
    icon: () => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  },
  {
    href: "/admin/leads",
    label: "Leads",
    icon: () => (
      <svg
        width="18"
        height="18"
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
    )
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: () => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  },
  {
    href: "/admin/projects",
    label: "Projects",
    icon: () => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2f" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    )
  },
  {
    href: "/admin/quotes",
    label: "Quotations",
    icon: () => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    )
  },
  {
    href: "/admin/payments",
    label: "Payments",
    icon: () => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    )
  }
];

export function AdminNav({ displayName, email, publicSiteUrl, children }: AdminNavProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const signOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  // Initialize sidebar collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sarathi_sidebar_collapsed");
      if (stored === "true") {
        setCollapsed(true);
      }
    } catch {
      // LocalStorage access not permitted or unavailable
    }
  }, []);

  // Close profile dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setProfileOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Toggle sidebar and persist
  function handleToggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sarathi_sidebar_collapsed", String(next));
      } catch {
        // LocalStorage access ignored
      }
      return next;
    });
  }

  async function handleSignOut() {
    if (signOutRef.current) return;
    signOutRef.current = true;
    setSigningOut(true);
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (!response.ok && response.status !== 401) {
        setSignOutError("Unable to sign out. Please try again.");
        return;
      }
      window.location.replace("/admin/login");
    } catch {
      setSignOutError("Unable to connect. Please try again.");
    } finally {
      signOutRef.current = false;
      setSigningOut(false);
    }
  }

  // Determine current page section for breadcrumbs
  const currentSection =
    NAV_ITEMS.find(({ href }) =>
      href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
    )?.label || "Workspace";

  // Initials for avatar
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "OP";

  return (
    <div className="admin-layout-container" data-collapsed={collapsed}>
      {/* Left Sidebar */}
      <aside
        className={`admin-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
        aria-label="Operations Navigation"
        data-collapsed={collapsed}
      >
        <div className="sidebar-header">
          <Link href="/admin" className="sidebar-brand" onClick={() => setMobileOpen(false)}>
            <div className="brand-mark" aria-hidden="true">
              S
            </div>
            <div className="sidebar-brand-text">
              <strong>SARATHI</strong>
              <small>SMART SOLUTIONS</small>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-nav-section-title">Operations Suite</div>
          <ul className="sidebar-nav-list">
            {NAV_ITEMS.map(({ href, label, icon }) => {
              const isActive =
                href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <li key={href} className="sidebar-nav-item">
                  <Link
                    href={href}
                    className={`sidebar-nav-link ${isActive ? "active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="sidebar-nav-icon">{icon(isActive)}</span>
                    <span className="sidebar-nav-label">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            onClick={handleToggleCollapse}
            className="sidebar-collapse-btn"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
              style={{
                transform: collapsed ? "rotate(180deg)" : "none",
                transition: "transform 0.2s"
              }}
              aria-hidden="true"
            >
              <polyline points="11 19 4 12 11 5" />
              <polyline points="18 19 11 12 18 5" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      {/* Main Content Wrap */}
      <div
        className="admin-main-wrap min-h-screen transition-[margin] duration-200 lg:ml-[264px] data-[collapsed=true]:lg:ml-[72px]"
        data-collapsed={collapsed}
      >
        {/* Top Header */}
        <header className="admin-top-header">
          <div className="header-left-group">
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <div className="header-breadcrumb">
              <span className="breadcrumb-root">Operations</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{currentSection}</span>
            </div>

            <div className="header-status-pill" title="System operational and connected">
              <span className="header-status-dot" aria-hidden="true" />
              <span>Live Operations</span>
            </div>
          </div>

          <div className="header-right-group">
            <ThemeToggle />

            {publicSiteUrl && (
              <a
                href={publicSiteUrl}
                target="_blank"
                rel="noreferrer"
                className="public-site-btn"
                title="Open customer-facing website"
              >
                <span>Public Site</span>
                <span aria-hidden="true">↗</span>
              </a>
            )}

            {/* User Profile Dropdown */}
            <div className="user-dropdown-wrap" ref={dropdownRef}>
              <button
                type="button"
                className="user-profile-btn"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                id="user-menu-button"
                aria-label={`User menu for ${displayName}`}
              >
                <div className="user-avatar-badge" aria-hidden="true">
                  {initials}
                </div>
                <div className="user-btn-details">
                  <span className="user-btn-name">{displayName}</span>
                  <span className="user-btn-role">Administrator</span>
                </div>
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
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {profileOpen && (
                <div
                  className="user-dropdown-menu"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu-button"
                >
                  <div className="dropdown-user-info">
                    <div className="dropdown-user-name">{displayName}</div>
                    <div className="dropdown-user-role">Operations Administrator</div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--muted)",
                        marginTop: "4px",
                        overflowWrap: "anywhere"
                      }}
                    >
                      Account: {email}
                    </div>
                  </div>

                  {publicSiteUrl && (
                    <a
                      href={publicSiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="dropdown-item"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      <span>Public Website ↗</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="dropdown-item dropdown-signout"
                    role="menuitem"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>{signingOut ? "Signing out…" : "Log Out"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="admin-body">
          {signOutError && (
            <p className="form-error-banner" role="alert">
              {signOutError}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
