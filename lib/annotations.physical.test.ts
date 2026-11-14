import { describe, expect, it } from "vitest";
import { physicalBill, physicalEob, physicalPlan } from "../data/samples/physical";
import { markUpBill } from "./annotations";
import { runEngine, summarize } from "./engine";

// The annual physical has three findings, one of them low confidence:
// every one must still get its own numbered mark on the paper bill.
const findings = runEngine(physicalBill, physicalEob, physicalPlan);
const { fairAmount } = summarize(physicalBill, findings);
const markup = markUpBill(physicalBill, findings, fairAmount);
const markAt = (code: string) => markup.lines[physicalBill.lines.findIndex((l) => l.code === code)];

describe("markUpBill on the annual physical", () => {
  it("marks one line per finding, with that finding's number", () => {
    const marked = markup.lines
      .filter(Boolean)
      .map((m) => m!.finding)
      .sort();
    expect(marked).toEqual(findings.map((_, i) => i));
    expect(markup.loose).toEqual([]);
  });

  it("puts the right note on each line, including the low-confidence split visit", () => {
    expect(findings[markAt("99213")!.finding]).toMatchObject({
      type: "split_visit",
      confidence: "low",
    });
    expect(markAt("99213")!.note).toBe("split visit?");
    expect(markAt("99395")!.note).toBe("preventive = $0");
    expect(markAt("80061")!.note).toBe("preventive = $0");
  });

  it("does not count the split visit in the corrected total", () => {
    expect(markup.correctedTotal).toBe(334);
  });
});
