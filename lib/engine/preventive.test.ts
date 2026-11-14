import { describe, expect, it } from "vitest";
import { physicalBill, physicalEob, physicalPlan } from "../../data/samples/physical";
import { sampleBill, sampleEob, samplePlan } from "../../data/samples/sample";
import { runEngine, summarize } from "./index";

describe("the 'free' physical sample", () => {
  const findings = runEngine(physicalBill, physicalEob, physicalPlan);
  const byId = Object.fromEntries(findings.map((f) => [f.id, f]));

  it("flags the copay on the preventive visit", () => {
    expect(byId["preventive-99395"]).toMatchObject({ amount: 45, confidence: "high", target: "insurer" });
  });

  it("flags the cholesterol screening billed as diagnostic", () => {
    expect(byId["screening-80061"]).toMatchObject({ amount: 28, confidence: "medium", target: "provider" });
  });

  it("flags the split visit as worth asking, not as money back", () => {
    expect(byId["split-99213-2026-08-04"]).toMatchObject({ amount: 112, confidence: "low" });
    expect(summarize(physicalBill, findings)).toEqual({
      amountBilled: 407,
      potentialSavings: 73,
      fairAmount: 334,
    });
  });

  it("does not double count preventive lines in the deductible math", () => {
    expect(findings.some((f) => f.type === "plan_math")).toBe(false);
  });

  it("ignores preventive rules out of network", () => {
    const out = runEngine(physicalBill, physicalEob, { ...physicalPlan, inNetwork: false });
    expect(out.some((f) => f.type === "preventive_cost_sharing" || f.type === "split_visit")).toBe(false);
  });
});

describe("the ER sample is unchanged by the preventive rules", () => {
  it("still totals $2,547.00", () => {
    const findings = runEngine(sampleBill, sampleEob, samplePlan);
    expect(summarize(sampleBill, findings).potentialSavings).toBe(2547);
  });
});
