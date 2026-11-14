import { describe, expect, it } from "vitest";
import { physicalBill, physicalEob, physicalPlan } from "../../data/samples/physical";
import { sampleBill, sampleEob, samplePlan } from "../../data/samples/sample";
import { runEngine, summarize } from "../engine";
import type { AnalysisResult, Bill, Eob } from "../types";
import { buildActionPlan } from "./actions";
import { EMPTY_SITUATION } from "./situation";

function caseOf(bill: Bill, eob: Eob | null = sampleEob, plan = samplePlan): AnalysisResult {
  const findings = runEngine(bill, eob, plan);
  return {
    plan, bill, eob, findings, ...summarize(bill, findings),
    meta: { aiExtraction: false, aiExplanations: false, model: null, hasEob: eob !== null },
  };
}

const kinds = (r: AnalysisResult, s = EMPTY_SITUATION) => buildActionPlan(r, s).map((a) => a.kind);

describe("buildActionPlan", () => {
  it("decodes the ER denial into a medical necessity fix", () => {
    const denial = buildActionPlan(caseOf(sampleBill), EMPTY_SITUATION).find((a) => a.kind === "denial_fix");
    expect(denial?.denial?.category).toBe("medical_necessity");
  });

  it("dates the appeal deadline from the denial notice", () => {
    const plan = buildActionPlan(caseOf(sampleBill), { ...EMPTY_SITUATION, denialNoticeDate: "2026-10-10" });
    expect(plan.find((a) => a.kind === "denial_fix")?.deadline?.date).toBe("2027-04-08");
  });

  it("spots the hospital facility fee on the physical", () => {
    const plan = buildActionPlan(caseOf(physicalBill, physicalEob, physicalPlan), EMPTY_SITUATION);
    const fee = plan.find((a) => a.kind === "facility_fee");
    expect(fee?.title).toContain("$240.00");
    expect(fee?.letter?.text).toContain("G0463");
  });

  it("asks for an itemized bill when the bill is a summary", () => {
    const summary: Bill = { ...sampleBill, lines: [{ date: "2026-09-18", code: "", description: "Hospital services", quantity: 1, charge: 6298 }] };
    expect(kinds(caseOf(summary, null))[0]).toBe("itemized_bill");
  });

  it("warns when insurance was never billed", () => {
    const unbilled: Bill = { ...sampleBill, insurancePaid: 0, adjustments: 0, amountDue: 6298 };
    expect(kinds(caseOf(unbilled, null))).toContain("never_billed");
    expect(kinds(caseOf(unbilled, null), { ...EMPTY_SITUATION, selfPay: true })).not.toContain("never_billed");
  });

  it("opens the Good Faith Estimate dispute at $400 over, with a 120-day deadline", () => {
    const situation = { ...EMPTY_SITUATION, selfPay: true, goodFaithEstimate: 3300 };
    const gfe = buildActionPlan(caseOf(sampleBill, null), situation).find((a) => a.kind === "good_faith_estimate");
    expect(gfe?.deadline?.date).toBe("2027-02-24");
    const under = { ...situation, goodFaithEstimate: 3400 };
    expect(kinds(caseOf(sampleBill, null), under)).not.toContain("good_faith_estimate");
  });

  it("adds collections protection with a 30-day validation deadline", () => {
    const situation = { ...EMPTY_SITUATION, inCollections: true, collectionNoticeDate: "2026-11-01" };
    const action = buildActionPlan(caseOf(sampleBill), situation).find((a) => a.kind === "collections");
    expect(action?.deadline?.date).toBe("2026-12-01");
    expect(action?.letter?.text).toContain("Fair Debt Collection Practices Act");
  });

  it("always ends with how to pay safely", () => {
    const plan = kinds(caseOf(sampleBill));
    expect(plan[plan.length - 1]).toBe("before_you_pay");
  });
});
