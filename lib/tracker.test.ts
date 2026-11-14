import { describe, expect, it } from "vitest";
import { sampleBill, sampleEob, samplePlan } from "../data/samples/sample";
import { runEngine, summarize } from "./engine";
import { buildIcs, buildSteps, sentDate, stepDueDate } from "./tracker";
import type { AnalysisResult } from "./types";

const findings = runEngine(sampleBill, sampleEob, samplePlan);
const result: AnalysisResult = {
  plan: samplePlan,
  bill: sampleBill,
  eob: sampleEob,
  findings,
  ...summarize(sampleBill, findings),
  meta: { aiExtraction: false, aiExplanations: false, model: null, hasEob: true },
};
const steps = buildSteps(result);
const call = steps.find((s) => s.id === "call")!;
const created = "2026-11-01T12:00:00.000Z";

describe("follow-up deadlines", () => {
  it("are unknown until a letter is marked as sent", () => {
    expect(sentDate(steps, {})).toBeNull();
    expect(stepDueDate(call, created, null)).toBeNull();
  });

  it("count from the day the letters were sent, not from the case date", () => {
    const done = { "send-provider": "2026-11-10T12:00:00.000Z" };
    const sent = sentDate(steps, done);
    expect(sent).toBe("2026-11-10T12:00:00.000Z");
    expect(stepDueDate(call, created, sent)?.toISOString().slice(0, 10)).toBe("2026-11-24");
  });

  it("use the earliest send date when both letters went out", () => {
    const done = {
      "send-insurer": "2026-11-12T12:00:00.000Z",
      "send-provider": "2026-11-10T12:00:00.000Z",
      call: "2026-11-20T12:00:00.000Z",
    };
    expect(sentDate(steps, done)).toBe("2026-11-10T12:00:00.000Z");
  });

  it("put calendar reminders on the same dates", () => {
    const ics = buildIcs("2026-11-10T12:00:00.000Z", steps);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261124");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });
});
