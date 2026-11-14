"use client";

import { saveCase, type StoredCase } from "@/lib/caseStore";
import { buildIcs, buildSteps, dueDate } from "@/lib/tracker";

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The follow-up plan. Progress is saved in this browser. */
export function CaseTracker({ saved }: { saved: StoredCase }) {
  const steps = buildSteps(saved.result, saved.household);
  const doneCount = steps.filter((s) => saved.done[s.id]).length;

  function toggle(id: string) {
    const done = { ...saved.done };
    if (done[id]) delete done[id];
    else done[id] = new Date().toISOString();
    saveCase({ ...saved, done });
  }

  function downloadCalendar() {
    const blob = new Blob([buildIcs(saved.createdAt, steps)], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "claimback-follow-ups.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Your follow-up plan</h2>
        <span className="money text-sm text-muted">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Disputes are won by following up. This plan is saved in this browser, so you can come back
        to it.
      </p>

      <ol className="mt-4 divide-y divide-line rounded-lg border border-line bg-card">
        {steps.map((step) => {
          const done = Boolean(saved.done[step.id]);
          return (
            <li key={step.id}>
              <label className="flex cursor-pointer gap-4 px-5 py-4">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(step.id)}
                  className="mt-1 size-4 accent-accent"
                />
                <span className="flex-1">
                  <span className={`block font-medium ${done ? "text-muted line-through" : ""}`}>
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{step.detail}</span>
                </span>
                <span className="money shrink-0 text-xs text-muted">
                  {step.dayOffset === 0
                    ? "Today"
                    : formatDate(dueDate(saved.createdAt, step.dayOffset))}
                </span>
              </label>
            </li>
          );
        })}
      </ol>

      <button
        onClick={downloadCalendar}
        className="no-print mt-4 rounded-lg border border-ink/25 bg-card px-4 py-2 text-sm font-medium hover:border-ink"
      >
        Add these dates to my calendar (.ics)
      </button>
    </section>
  );
}
