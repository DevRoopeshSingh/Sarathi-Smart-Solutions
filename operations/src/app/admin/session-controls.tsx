"use client";

import { useEffect, useState } from "react";

export function SessionControls() {
  const [pending, setPending] = useState<"current" | "all" | null>(null);
  const [showRevokeModal, setShowRevokeModal] = useState<boolean>(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowRevokeModal(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function signOut(scope: "current" | "all") {
    if (pending) return;
    setPending(scope);
    setError("");
    try {
      const response = await fetch(
        scope === "all" ? "/api/admin/revoke-sessions" : "/api/auth/sign-out",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        }
      );
      if (!response.ok && response.status !== 401) {
        setError("Unable to sign out. Please try again.");
        return;
      }
      window.location.replace("/admin/login");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="session-controls" aria-busy={pending !== null}>
      <div className="button-row">
        <button
          className="admin-btn admin-btn-secondary"
          type="button"
          onClick={() => signOut("current")}
          disabled={pending !== null}
        >
          {pending === "current" ? "Signing out…" : "Sign out"}
        </button>
        <button
          className="admin-btn admin-btn-danger-outline"
          type="button"
          onClick={() => setShowRevokeModal(true)}
          disabled={pending !== null}
          title="Revoke session tokens across all devices"
        >
          {pending === "all" ? "Signing out everywhere…" : "Sign out all devices"}
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && (
          <p role="alert" className="form-error" style={{ marginTop: "12px" }}>
            {error}
          </p>
        )}
      </div>

      {showRevokeModal && (
        <div className="modal-backdrop" onClick={() => setShowRevokeModal(false)}>
          <div
            className="modal-dialog"
            role="dialog"
            aria-labelledby="revoke-modal-title"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "460px" }}
          >
            <div className="modal-header">
              <h3 id="revoke-modal-title" style={{ color: "var(--status-danger-text)" }}>
                Revoke All Active Sessions?
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowRevokeModal(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="modal-form" style={{ padding: "20px 24px" }}>
              <p style={{ margin: "0 0 16px", color: "var(--ink)", fontSize: "14px", lineHeight: 1.5 }}>
                This action will immediately terminate all active sessions for your administrator account across all browsers, mobile devices, and computers.
              </p>
              <div
                style={{
                  background: "var(--status-danger-bg)",
                  border: "1px solid var(--status-danger-border)",
                  borderRadius: "6px",
                  padding: "12px 14px",
                  color: "var(--status-danger-text)",
                  fontSize: "13px",
                  lineHeight: 1.4,
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start"
                }}
              >
                <span aria-hidden="true">⚠️</span>
                <span>Your current session will also end and you will be returned to the sign-in page.</span>
              </div>

              <div className="modal-footer" style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setShowRevokeModal(false)}
                  className="admin-btn admin-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRevokeModal(false);
                    signOut("all");
                  }}
                  className="admin-btn"
                  style={{
                    background: "var(--status-danger-text)",
                    color: "#FFFFFF",
                    borderColor: "var(--status-danger-text)"
                  }}
                >
                  Yes, Sign Out Everywhere
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
