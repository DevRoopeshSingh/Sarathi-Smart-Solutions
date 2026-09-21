"use client";

import { useState, type FormEvent } from "react";

export function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? "")
        })
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many sign-in attempts. Please wait before trying again."
            : "Unable to sign in. Check your details or contact your administrator."
        );
        return;
      }
      window.location.replace("/admin");
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={signIn} aria-busy={pending}>
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          disabled={pending}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          disabled={pending}
          aria-describedby="sign-in-note"
        />
      </div>
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button className="button button-primary sign-in-button" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
        <span aria-hidden="true">↗</span>
      </button>
      <p className="form-note" id="sign-in-note">
        Use the administrator account provided to you. Administrator access only.
      </p>
    </form>
  );
}
