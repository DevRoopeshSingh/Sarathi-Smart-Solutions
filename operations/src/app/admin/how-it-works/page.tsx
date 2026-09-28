import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getActor } from "@/server/dal";
import { LEAD_STAGES, PROJECT_STAGES, QUOTE_STAGES, ROLE_GUIDANCE } from "@/lib/workflow";
import { LifecycleDiagram } from "@/components/workflow/lifecycle-diagram";
import { ReplayTourButton } from "@/components/workflow/onboarding-tour";

export const metadata = { title: "How it works" };
export const dynamic = "force-dynamic";
export default async function HowItWorksPage() {
  const actor = await getActor(await headers());
  if (!actor) redirect("/admin/login");
  return (
    <div className="workspace-shell">
      <main id="main" className="workspace-main">
        <section className="workspace-heading">
          <span className="eyebrow">THE SARATHI WAY</span>
          <h1>How it works</h1>
          <p className="lead-copy">From the first enquiry to a confident customer handover.</p>
          <ReplayTourButton />
        </section>
        <LifecycleDiagram />
        <section className="workflow-panel">
          <h2>Your role: {actor.role}</h2>
          <p>{ROLE_GUIDANCE[actor.role]}</p>
          <p>
            Open a record’s name to see its details, linked records, previous and next steps, and
            recorded activity.
          </p>
          <Link
            className="admin-btn admin-btn-primary"
            href={actor.role === "VIEWER" ? "/admin/leads" : "/admin/leads?new=1"}
          >
            {actor.role === "VIEWER" ? "Explore leads" : "Capture an enquiry"}
          </Link>
        </section>
        <section className="workflow-panel">
          <h2>A practical example</h2>
          <p>
            A customer asks for four CCTV cameras. Capture the enquiry, contact them, and qualify
            the requirement. Choose or create their customer record and convert the lead to a
            project. Survey the site and prepare the costing and quotation through your team’s
            current process. Once terms and payment readiness are confirmed, arrange materials,
            install, test, and hand over.
          </p>
          <p>
            The project begins during planning. An approved quotation does not create a second
            project, and marking Completed does not settle a payment balance.
          </p>
        </section>
        <section className="workflow-panel">
          <h2>What you can do today</h2>
          <ul className="tw:space-y-2 tw:pl-5">
            <li>
              Capture customers and leads, convert leads and update project stages with the
              permissions for your role.
            </li>
            <li>
              Read existing quotations and their recorded decisions. Creating, editing, issuing and
              sending quotations, survey uploads and payment entry are not available in this
              workspace yet.
            </li>
            <li>
              For those steps, coordinate with your team’s current process. A suggested next step is
              guidance, not a button that performs the work.
            </li>
          </ul>
        </section>
        {(
          [
            ["Lead stages", LEAD_STAGES],
            ["Quotation stages", QUOTE_STAGES],
            ["Project stages", PROJECT_STAGES]
          ] as const
        ).map(([title, stages]) => (
          <section className="workflow-panel" key={title}>
            <h2>{title}</h2>
            <div className="tw:grid tw:gap-3 tw:md:grid-cols-2">
              {Object.entries(stages).map(([key, stage]) => (
                <details
                  key={key}
                  className="tw:rounded-lg tw:border tw:border-solid tw:border-[var(--line)] tw:p-4"
                >
                  <summary className="tw:cursor-pointer tw:font-semibold">{stage.label}</summary>
                  <p>{stage.description}</p>
                  <p className="tw:text-sm">
                    <strong>Next:</strong> {stage.next}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <section className="workflow-panel">
          <h2>Exceptions and activity</h2>
          <p>
            Normal stages move forward. Skipping, moving backwards, cancelling or reopening requires
            a recorded reason. A held project cannot change stage until its hold is released; hold
            management is not available in this UI yet. Ask an administrator to arrange it.
          </p>
          <p>
            Activity shows saved creation dates, quotation timestamps and project stage changes,
            including the actor and reason when recorded. Missing history is not filled in. Times
            use India Standard Time.
          </p>
        </section>
      </main>
    </div>
  );
}
