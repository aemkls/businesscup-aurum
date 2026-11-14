"use client";

import { saveCase, type StoredCase } from "@/lib/caseStore";
import { downloadText } from "@/lib/download";
import { buildIcs, buildSteps, sentDate, stepDueDate, type TrackerStep } from "@/lib/tracker";
import { Button, Chip, TextButton } from "./ui";

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * The follow-up plan as a timeline. Marking a letter as sent records the
 * date, and every follow-up deadline counts from it. Saved in this browser.
 */
export function CaseTracker({ saved }: { saved: StoredCase }) {
  const steps = buildSteps(saved.result, saved.household);
  const doneCount = steps.filter((s) => saved.done[s.id]).length;
  const sent = sentDate(steps, saved.done);
  const percent = Math.round((doneCount / steps.length) * 100);

  function toggle(id: string) {
    const done = { ...saved.done };
    if (done[id]) delete done[id];
    else done[id] = new Date().toISOString();
    saveCase({ ...saved, done });
  }

  function downloadCalendar() {
    downloadText("claimback-reminders.ics", buildIcs(sent ?? saved.createdAt, steps), "text/calendar");
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-tagline font-semibold">Your follow-up plan</h2>
        <span className="money text-caption text-ink-muted">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-parchment"
        role="progressbar"
        aria-label="Steps done"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div className="h-full rounded-full bg-ok transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-caption text-ink-muted">
        {sent
          ? `Letters sent ${formatDate(new Date(sent))}. Follow-up dates count from that day.`
          : "Mark your letter as sent and the follow-up dates will count from that day."}
      </p>

      <ol className="mt-8">
        {steps.map((step, i) => (
          <TimelineStep
            key={step.id}
            step={step}
            last={i === steps.length - 1}
            doneAt={saved.done[step.id]}
            due={stepDueDate(step, saved.createdAt, sent)}
            onToggle={() => toggle(step.id)}
          />
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button onClick={downloadCalendar}>Add reminders to my calendar</Button>
        <span className="text-caption text-ink-muted">An .ics file for Google, Apple or Outlook calendar.</span>
      </div>
    </div>
  );
}

function TimelineStep({
  step,
  last,
  doneAt,
  due,
  onToggle,
}: {
  step: TrackerStep;
  last: boolean;
  doneAt: string | undefined;
  due: Date | null;
  onToggle: () => void;
}) {
  const done = Boolean(doneAt);
  const isSend = step.dayOffset === 0;
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {!last && (
        <span aria-hidden="true" className="absolute left-[11px] top-7 h-[calc(100%-28px)] w-px bg-hairline" />
      )}
      <span
        aria-hidden="true"
        className={`relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-fine font-semibold ${
          done ? "bg-ok text-white" : "border border-hairline bg-canvas"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 className={`text-body font-semibold ${done ? "text-ink-muted" : ""}`}>{step.title}</h3>
          <span className="money shrink-0 text-caption text-ink-muted">
            {done
              ? `Done ${formatDate(new Date(doneAt!))}`
              : due
                ? `Due ${formatDate(due)}`
                : `${step.dayOffset} days after sending`}
          </span>
        </div>
        <p className="mt-1 text-caption text-ink-muted">{step.detail}</p>
        <div className="mt-3 flex items-center gap-3">
          {done && <Chip tone="ok">Done</Chip>}
          <TextButton onClick={onToggle}>
            {done ? "Undo" : isSend ? "Mark as sent" : "Mark as done"}
          </TextButton>
        </div>
      </div>
    </li>
  );
}
