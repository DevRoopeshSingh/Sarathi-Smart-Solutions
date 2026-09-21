"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="error-page">
      <span className="eyebrow">SARATHI OPERATIONS</span>
      <h1>Workspace unavailable.</h1>
      <p>We could not load this page. Try again in a moment.</p>
      <button className="button button-primary" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
