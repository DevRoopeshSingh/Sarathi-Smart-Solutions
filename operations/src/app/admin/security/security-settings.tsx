"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function SecuritySettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uri, setUri] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const action = data.get("action");
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        action === "verify" ? "/api/auth/two-factor/verify-totp" : "/api/admin/security",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(
            action === "verify"
              ? { code: data.get("code") }
              : { action, password: data.get("password") }
          )
        }
      );
      if (!response.ok) {
        setError("Unable to update security settings. Check your password or code and try again.");
        return;
      }
      const result: { totpURI?: string; backupCodes?: string[] } = await response.json();
      form.reset();
      if (result.totpURI) {
        setUri(result.totpURI);
        setSaved(false);
      }
      if (result.backupCodes) {
        setCodes(result.backupCodes);
        setSaved(false);
      }
      if (action === "verify") {
        setUri("");
        setCodes([]);
        setMessage("Authenticator enabled. Future sign-ins require a code.");
      }
      if (action === "disable") {
        setUri("");
        setCodes([]);
        setMessage("Authenticator disabled.");
      }
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const secret = uri ? new URL(uri).searchParams.get("secret") : "";
  return (
    <section className="admin-card" style={{ maxWidth: 640 }} aria-busy={pending}>
      <p>
        Authenticator: <strong>{enabled ? "Enabled" : "Not enabled"}</strong>
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!uri && (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="security-password">Current password</label>
            <input
              id="security-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              disabled={pending}
            />
          </div>
          <div className="field">
            <label htmlFor="security-action">Security action</label>
            <select id="security-action" name="action" className="admin-input" disabled={pending}>
              {enabled ? (
                <>
                  <option value="backup-codes">Replace recovery codes</option>
                  <option value="disable">Disable authenticator</option>
                </>
              ) : (
                <option value="enable">Set up authenticator</option>
              )}
            </select>
          </div>
          <button className="admin-btn admin-btn-primary" disabled={pending}>
            {pending ? "Updating…" : "Continue"}
          </button>
        </form>
      )}
      {uri && (
        <div>
          <p>
            Add a time-based account in your authenticator app, named “Sarathi Operations”, using
            this setup key:
          </p>
          <code style={{ overflowWrap: "anywhere" }}>{secret}</code>
          <p>Keep this key private. Codes use six digits and change every 30 seconds.</p>
        </div>
      )}
      {codes.length > 0 && (
        <div>
          <p>
            Save these recovery codes securely. Each works once; replacing codes invalidates the old
            set.
          </p>
          <ul>
            {codes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <label>
            <input
              type="checkbox"
              checked={saved}
              onChange={(event) => setSaved(event.target.checked)}
            />{" "}
            I saved my recovery codes
          </label>
          {!uri && saved && (
            <button className="admin-btn" onClick={() => setCodes([])}>
              Hide recovery codes
            </button>
          )}
        </div>
      )}
      {uri && (
        <form onSubmit={submit}>
          <input type="hidden" name="action" value="verify" />
          <div className="field">
            <label htmlFor="setup-code">Authenticator code</label>
            <input
              id="setup-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              maxLength={6}
              disabled={pending}
            />
          </div>
          <button className="admin-btn admin-btn-primary" disabled={pending || !saved}>
            Verify & enable
          </button>
        </form>
      )}
    </section>
  );
}
