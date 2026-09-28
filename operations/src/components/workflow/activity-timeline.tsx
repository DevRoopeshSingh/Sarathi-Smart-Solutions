import { formatIndiaDate } from "@/lib/date";
import type { ActivityEvent } from "@/lib/workflow";

export function ActivityTimeline({
  events,
  truncated = false
}: {
  events: ActivityEvent[];
  truncated?: boolean;
}) {
  return (
    <section className="workflow-panel" aria-label="Activity timeline">
      <h2>Recorded activity</h2>
      <p className="tw:text-sm tw:text-[var(--muted)]">
        Newest first · India time (IST). Only recorded events are shown; earlier lead status changes
        and unrecorded quotation decisions are not reconstructed.
      </p>
      {truncated && <p role="note">Showing the latest 50 events.</p>}
      {events.length === 0 ? (
        <p>No recorded activity is available yet.</p>
      ) : (
        <ol className="tw:list-none tw:p-0 tw:space-y-5">
          {events.map((event) => (
            <li
              key={event.id}
              className="tw:border-0 tw:border-l-2 tw:border-solid tw:border-[var(--accent)] tw:pl-4"
            >
              <h3>{event.title}</h3>
              <p className="tw:my-1 tw:text-xs tw:text-[var(--muted)]">
                <time dateTime={event.at}>{formatIndiaDate(event.at)}</time>
                {event.actor && ` · ${event.actor}`}
              </p>
              {event.description && (
                <p className="tw:my-1 tw:text-sm tw:whitespace-pre-wrap">{event.description}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
