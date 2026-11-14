"use client";

import { useState } from "react";
import { saveCase, type StoredCase } from "@/lib/caseStore";
import { downloadText } from "@/lib/download";
import { buildIcs, buildSteps, sentDate, stepDueDate, type TrackerStep } from "@/lib/tracker";
import { Button, TextButton } from "./ui";

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * The follow-up plan as a timeline in the case file. Marking a letter as
 * sent stamps it with the date, and every follow-up deadline counts from
 * that date. Saved in this browser.
 */
export function CaseTracker({ saved }: { saved: StoredCase }) {
  const steps = buildSteps(saved.result, saved.household);
  const doneCount = steps.filter((s) => saved.done[s.id]).length;
  const sent = sentDate(steps, saved.done);
  const percent = Math.round((doneCount / steps.length) * 100);
  // Only a step the user just marked gets the stamp animation.
  const [justDone, setJustDone] = useState<string | null>(null);

  function toggle(id: string) {
    const done = { ...saved.done };
    if (done[id]) {
      delete done[id];
      setJustDone(null);
    } else {
      done[id] = new Date().toISOString();
      setJustDone(id);
    }
    saveCase({ ...saved, done });
  }

  function downloadCalendar() {
    downloadText(
      "claimback-reminders.ics",
      buildIcs(sent ?? saved.createdAt, steps),
      "text/calendar",
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-tagline font-bold">Follow-up plan</h2>
        <span className="font-mono text-caption text-ink-muted">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-desk"
        role="progressbar"
        aria-label="Steps done"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div
          className="h-full rounded-full bg-ok transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-caption text-ink-muted">
        {sent
          ? `Letters sent ${formatDate(new Date(sent))}. Follow-up dates count from that day.`
          : "Mark a letter as sent and the follow-up dates will count from that day."}
      </p>

      <ol className="mt-8">
        {steps.map((step, i) => (
          <TimelineStep
            key={step.id}
            step={step}
            last={i === steps.length - 1}
            doneAt={saved.done[step.id]}
            animate={justDone === step.id}
            due={stepDueDate(step, saved.createdAt, sent)}
            onToggle={() => toggle(step.id)}
          />
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-dashed border-rule pt-6">
        <Button onClick={downloadCalendar}>Add reminders to my calendar</Button>
        <span className="text-caption text-ink-muted">
          An .ics file for Google, Apple or Outlook calendar.
        </span>
      </div>
    </div>
  );
}

function TimelineStep({
  step,
  last,
  doneAt,
  animate,
  due,
  onToggle,
}: {
  step: TrackerStep;
  last: boolean;
  doneAt: string | undefined;
  animate: boolean;
  due: Date | null;
  onToggle: () => void;
}) {
  const done = Boolean(doneAt);
  const isSend = step.dayOffset === 0;
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-[11px] top-7 h-[calc(100%-28px)] w-px border-l border-dashed border-rule"
        />
      )}
      <span
        aria-hidden="true"
        className="relative mt-0.5 size-6 shrink-0 rounded-[4px] border-2 border-bill-text/70 bg-paper"
      >
        {done && (
          <svg viewBox="0 0 24 24" className="absolute -left-1 -top-2 size-7 overflow-visible">
            <path
              d="M3 13 L9 19 L22 3"
              pathLength={1}
              fill="none"
              stroke="var(--color-pen)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={animate ? "mark-stroke" : ""}
            />
          </svg>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <h3 className={`text-body font-semibold ${done ? "text-ink-muted" : ""}`}>
            {step.title}
          </h3>
          <span className="shrink-0 font-mono text-fine text-ink-muted">
            {done
              ? `Done ${formatDate(new Date(doneAt!))}`
              : due
                ? `Due ${formatDate(due)}`
                : `${step.dayOffset} days after sending`}
          </span>
        </div>
        <p className="mt-1 text-caption text-ink-muted">{step.detail}</p>
        <div className="mt-3 flex min-h-8 flex-wrap items-center gap-x-5 gap-y-3">
          {done && isSend && <SentStamp date={doneAt!} animate={animate} />}
          <TextButton onClick={onToggle}>
            {done ? "Undo" : isSend ? "Mark as sent" : "Mark as done"}
          </TextButton>
        </div>
      </div>
    </li>
  );
}

/** A red rubber stamp with the date the letter went out. */
function SentStamp({ date, animate }: { date: string; animate: boolean }) {
  return (
    <span
      className={`inline-flex -rotate-[8deg] flex-col items-center rounded-[4px] border-[3px] border-double border-pen px-3 py-0.5 text-pen opacity-[0.92] ${
        animate ? "mark-stamp" : ""
      }`}
    >
      <span className="display text-[20px] font-extrabold leading-none tracking-[0.12em]">
        SENT
      </span>
      <span className="font-mono text-[11px] font-semibold leading-tight">
        {formatDate(new Date(date))}
      </span>
    </span>
  );
}
