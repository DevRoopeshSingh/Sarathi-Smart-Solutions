import type { Metadata } from "next";
import { headers } from "next/headers";
import { getAdminActor } from "@/server/dal";
import { readServerEnvironment } from "@/server/env";
import { AdminNav } from "./nav";
import "../globals.css";
import "../workflow.css";
import { OnboardingTour } from "@/components/workflow/onboarding-tour";
import { hasCompletedOnboarding } from "@/server/workflow";

export const metadata: Metadata = {
  title: { default: "Sarathi Operations", template: "%s · Sarathi Operations" },
  description: "Private administrator workspace for Sarathi Smart Solutions.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer"
};

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const actor = await getAdminActor(requestHeaders);
  const completed = actor ? await hasCompletedOnboarding(requestHeaders) : true;
  const { publicSiteUrl } = readServerEnvironment();

  return (
    <div className="admin-root">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {actor ? (
        <AdminNav
          displayName={actor.displayName}
          email={actor.email}
          role={actor.role}
          publicSiteUrl={publicSiteUrl}
        >
          <OnboardingTour key={actor.id} completed={completed} role={actor.role} />
          {children}
        </AdminNav>
      ) : (
        <div className="admin-body">{children}</div>
      )}
    </div>
  );
}
