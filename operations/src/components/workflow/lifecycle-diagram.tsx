import Link from "next/link";
import { FLOW_STEPS, type FlowStep } from "@/lib/workflow";

export function LifecycleDiagram({ current }: { current?: FlowStep }) {
  return (
    <section className="workflow-panel" aria-label="Lead to delivery lifecycle">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
        <h2>Lead → Quotation → Project delivery</h2>
        <Link href="/admin/how-it-works">How it works</Link>
      </div>
      <p className="tw:text-sm tw:text-[var(--muted)]">
        One customer journey. The project record starts before the quotation, to hold the survey and
        costing.
      </p>
      <ol className="tw:grid tw:list-none tw:p-0 tw:gap-3 tw:sm:grid-cols-2 tw:xl:grid-cols-4">
        {FLOW_STEPS.map((step, index) => (
          <li
            key={step.id}
            aria-current={current === step.id ? "step" : undefined}
            className={`tw:rounded-lg tw:border tw:border-solid tw:p-4 ${current === step.id ? "tw:border-[var(--accent)] tw:bg-[var(--accent-tint)]" : "tw:border-[var(--line)]"}`}
          >
            <span className="tw:text-xs tw:font-bold tw:text-[var(--accent)]">
              {index + 1} {current === step.id && "· Current focus"}
            </span>
            <h3 className="tw:mt-2">
              <Link href={step.href}>{step.title}</Link>
            </h3>
            <p className="tw:m-0 tw:text-sm">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
