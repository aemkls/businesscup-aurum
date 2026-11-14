import { assistanceTier, fplPercent, type Household } from "./engine/assistance";
import type { AnalysisResult } from "./types";

/** One step of the dispute plan, due a number of days after the case started. */
export interface TrackerStep {
  id: string;
  dayOffset: number;
  title: string;
  detail: string;
}

/** Builds the follow-up plan from what was actually found. */
export function buildSteps(result: AnalysisResult, household?: Household | null): TrackerStep[] {
  const toProvider = result.findings.some((f) => f.target === "provider");
  const toInsurer = result.findings.some((f) => f.target === "insurer");
  const steps: TrackerStep[] = [];

  if (toProvider) {
    steps.push({
      id: "send-provider",
      dayOffset: 0,
      title: `Send the dispute letter to ${result.bill.provider}`,
      detail: "Mail it or upload it in the patient portal. Keep a copy and proof of the date.",
    });
  }
  if (toInsurer && result.eob) {
    steps.push({
      id: "send-insurer",
      dayOffset: 0,
      title: `File the appeal with ${result.eob.insurer}`,
      detail: "Use the appeals address or fax number printed on your EOB.",
    });
  }
  if (household && assistanceTier(fplPercent(household)) !== "unlikely") {
    steps.push({
      id: "assistance",
      dayOffset: 0,
      title: "Request the financial assistance application",
      detail:
        "Send the assistance letter, then return the form with proof of income as soon as it arrives.",
    });
  }
  steps.push(
    {
      id: "call",
      dayOffset: 14,
      title: "Call to confirm they received it",
      detail: "Use the call script. Write down the name, date and reference number.",
    },
    {
      id: "escalate",
      dayOffset: 30,
      title: "No written answer? Escalate",
      detail: toInsurer
        ? "Ask the hospital for a patient advocate, and file a complaint with your state insurance department."
        : "Ask the hospital for a patient advocate or a billing supervisor and resend the letter.",
    },
  );
  if (toInsurer) {
    steps.push({
      id: "appeal-deadline",
      dayOffset: 150,
      title: "Appeal deadline is one month away",
      detail:
        "Internal appeals are normally due within 180 days of the denial notice. Check the date on your EOB.",
    });
  }
  return steps;
}

export function dueDate(from: string, dayOffset: number): Date {
  const date = new Date(from);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

/**
 * When the letters went out: the earliest date one of the "send" steps
 * (due on day 0) was marked done, or null if nothing has been sent yet.
 * Follow-up deadlines count from this date, not from when the case was made.
 */
export function sentDate(steps: TrackerStep[], done: Record<string, string>): string | null {
  const dates = steps
    .filter((s) => s.dayOffset === 0 && done[s.id])
    .map((s) => done[s.id])
    .sort();
  return dates[0] ?? null;
}

/**
 * Due date of a step: send steps are due when the case starts; follow-ups
 * are due a number of days after sending, so null until something is sent.
 */
export function stepDueDate(
  step: TrackerStep,
  createdAt: string,
  sent: string | null,
): Date | null {
  if (step.dayOffset === 0) return dueDate(createdAt, 0);
  return sent ? dueDate(sent, step.dayOffset) : null;
}

const stamp = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

const escape = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** A deadline on a fixed date (from the action plan), e.g. a collector's 30-day window. */
export interface FixedDeadline {
  id: string;
  title: string;
  detail: string;
  /** ISO date, yyyy-mm-dd. */
  date: string;
}

/** An ISO date (yyyy-mm-dd) as a local Date at noon, so time zones never shift the day. */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * All-day calendar events for every step, as an .ics file body. `from` is
 * the day the letters were sent (or the day the case started, if not yet).
 * Fixed deadlines from the action plan are added on their own dates.
 */
export function buildIcs(
  from: string,
  steps: TrackerStep[],
  deadlines: FixedDeadline[] = [],
): string {
  const fixed = deadlines.map((d) => {
    const start = isoToDate(d.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return [
      "BEGIN:VEVENT",
      `UID:${d.id}-${stamp(start)}@claimback`,
      `DTSTAMP:${stamp(new Date(from))}T000000Z`,
      `DTSTART;VALUE=DATE:${stamp(start)}`,
      `DTEND;VALUE=DATE:${stamp(end)}`,
      `SUMMARY:${escape(`ClaimBack deadline: ${d.title}`)}`,
      `DESCRIPTION:${escape(d.detail)}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  const events = steps.map((step) => {
    const start = dueDate(from, step.dayOffset);
    const end = dueDate(from, step.dayOffset + 1);
    return [
      "BEGIN:VEVENT",
      `UID:${step.id}-${stamp(new Date(from))}@claimback`,
      `DTSTAMP:${stamp(new Date(from))}T000000Z`,
      `DTSTART;VALUE=DATE:${stamp(start)}`,
      `DTEND;VALUE=DATE:${stamp(end)}`,
      `SUMMARY:${escape(`ClaimBack: ${step.title}`)}`,
      `DESCRIPTION:${escape(step.detail)}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClaimBack//EN",
    ...events,
    ...fixed,
    "END:VCALENDAR",
  ].join("\r\n");
}
