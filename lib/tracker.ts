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
      detail: "Send the assistance letter, then return the form with proof of income as soon as it arrives.",
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
      detail: "Internal appeals are normally due within 180 days of the denial notice. Check the date on your EOB.",
    });
  }
  return steps;
}

export function dueDate(createdAt: string, dayOffset: number): Date {
  const date = new Date(createdAt);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

const stamp = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

const escape = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** All-day calendar events for every step, as an .ics file body. */
export function buildIcs(createdAt: string, steps: TrackerStep[]): string {
  const events = steps.map((step) => {
    const start = dueDate(createdAt, step.dayOffset);
    const end = dueDate(createdAt, step.dayOffset + 1);
    return [
      "BEGIN:VEVENT",
      `UID:${step.id}-${stamp(new Date(createdAt))}@claimback`,
      `DTSTAMP:${stamp(new Date(createdAt))}T000000Z`,
      `DTSTART;VALUE=DATE:${stamp(start)}`,
      `DTEND;VALUE=DATE:${stamp(end)}`,
      `SUMMARY:${escape(`ClaimBack: ${step.title}`)}`,
      `DESCRIPTION:${escape(step.detail)}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ClaimBack//EN", ...events, "END:VCALENDAR"].join(
    "\r\n",
  );
}
