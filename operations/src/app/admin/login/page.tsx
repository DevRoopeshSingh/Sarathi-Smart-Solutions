import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/server/dal";
import { readServerEnvironment } from "@/server/env";
import { Brand } from "../../brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdminActor(await headers())) redirect("/admin");
  const { publicSiteUrl } = readServerEnvironment();
  return (
    <div className="login-shell">
      <header className="site-header">
        <Brand />
        <span className="eyebrow header-label">OPERATIONS</span>
      </header>
      <main id="main" className="login-main">
        <div className="login-intro">
          <span className="eyebrow">
            <span className="small-rule" />
            PRIVATE WORKSPACE
          </span>
          <h1>
            Your business
            <br />
            <em>workspace.</em>
          </h1>
          <p>Sign in to view business records and manage your account.</p>
          <div className="intro-signature">
            SECURITY <span> / </span> CONNECTIVITY <span> / </span> AUTOMATION
          </div>
        </div>
        <section className="login-card" aria-labelledby="sign-in-title">
          <span className="eyebrow card-eyebrow">ADMINISTRATOR ACCESS</span>
          <h2 id="sign-in-title">Welcome back.</h2>
          <p className="card-description">Sign in to your workspace.</p>
          <LoginForm />
        </section>
      </main>
      <footer className="site-footer">
        <span>Sarathi Smart Solutions</span>
        {publicSiteUrl ? (
          <a href={publicSiteUrl}>Visit public website ↗</a>
        ) : (
          <span>Private business workspace</span>
        )}
      </footer>
    </div>
  );
}
