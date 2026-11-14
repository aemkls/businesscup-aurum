import { describe, expect, it } from "vitest";
import { sampleBill, sampleEob, samplePlan } from "../data/samples/sample";
import { markUpBill } from "./annotations";
import { runEngine, summarize } from "./engine";

const findings = runEngine(sampleBill, sampleEob, samplePlan);
const { fairAmount } = summarize(sampleBill, findings);
const markup = markUpBill(sampleBill, findings, fairAmount);
const at = (code: string, nth = 0) =>
  markup.lines.filter((_, i) => sampleBill.lines[i].code === code)[nth];

describe("markUpBill on the sample case", () => {
  it("strikes out only the repeated CT line, not the first one", () => {
    expect(at("70450", 0)).toBeNull();
    expect(at("70450", 1)).toMatchObject({ note: "billed twice", strikeLine: true });
  });

  it("corrects the venipuncture quantity from 10 to 1", () => {
    expect(at("36415")).toMatchObject({
      note: "should be 1",
      quantity: { from: 10, to: 1 },
      correctedCharge: 25,
    });
  });

  it("notes the denial and the rate above the insurer's", () => {
    expect(at("71046")?.note).toBe("insurer denied — appeal");
    expect(at("93005")?.note).toBe("above insurer rate");
  });

  it("keeps findings without a bill line as notes, and rewrites the total", () => {
    expect(markup.loose).toEqual([
      expect.objectContaining({ note: "insurer math is off", amount: 400 }),
    ]);
    expect(markup.correctedTotal).toBe(1182.8);
  });

  it("leaves a clean bill unmarked", () => {
    const clean = markUpBill(sampleBill, [], sampleBill.amountDue);
    expect(clean.lines.every((l) => l === null)).toBe(true);
    expect(clean.correctedTotal).toBeNull();
  });
});
