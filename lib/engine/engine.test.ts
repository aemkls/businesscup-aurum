import { describe, expect, it } from "vitest";
import { sampleBill, sampleEob, samplePlan } from "../../data/samples/sample";
import type { Bill, Eob } from "../types";
import { runEngine, summarize } from "./index";
import { expectedPatientShare } from "./planMath";

const byType = (findings: ReturnType<typeof runEngine>) =>
  Object.fromEntries(findings.map((f) => [f.type, f.amount]));

describe("expectedPatientShare", () => {
  it("applies the remaining deductible, then coinsurance", () => {
    expect(expectedPatientShare(1914, samplePlan)).toBe(1182.8);
  });

  it("charges only coinsurance once the deductible is met", () => {
    expect(expectedPatientShare(1000, { ...samplePlan, deductibleMet: 1500 })).toBe(200);
  });

  it("takes the copay first, then deductible and coinsurance on the rest", () => {
    // $250 copay; $750 left goes to the $1,000 deductible left.
    expect(expectedPatientShare(1000, { ...samplePlan, copay: 250 })).toBe(1000);
    // Deductible met: $250 copay + 20% of the remaining $750.
    expect(expectedPatientShare(1000, { ...samplePlan, copay: 250, deductibleMet: 1500 })).toBe(400);
  });

  it("never exceeds what is left of the out-of-pocket maximum", () => {
    expect(expectedPatientShare(50000, { ...samplePlan, oopMet: 5800 })).toBe(200);
  });
});

describe("runEngine on the sample case", () => {
  const findings = runEngine(sampleBill, sampleEob, samplePlan);

  it("finds exactly the five planted problems with the right amounts", () => {
    expect(byType(findings)).toEqual({
      duplicate_charge: 1420,
      plan_math: 400,
      denied_claim: 340,
      quantity_anomaly: 225,
      balance_billing: 162,
    });
  });

  it("adds up to the answer key", () => {
    expect(summarize(sampleBill, findings)).toEqual({
      amountBilled: 3729.8,
      potentialSavings: 2547,
      fairAmount: 1182.8,
    });
  });

  it("routes each finding to the right party", () => {
    const target = Object.fromEntries(findings.map((f) => [f.type, f.target]));
    expect(target.duplicate_charge).toBe("provider");
    expect(target.plan_math).toBe("insurer");
    expect(target.denied_claim).toBe("insurer");
  });
});

describe("runEngine on a clean case", () => {
  // Remove every planted error and check that nothing is flagged.
  const cleanBill: Bill = {
    ...sampleBill,
    lines: sampleBill.lines
      .filter((l, i) => !(l.code === "70450" && i === 2) && l.code !== "71046")
      .map((l) => (l.code === "36415" ? { ...l, quantity: 1, charge: 25 } : l)),
    amountDue: 1182.8,
  };
  const cleanEob: Eob = {
    ...sampleEob,
    lines: sampleEob.lines
      .filter((l) => l.status === "paid")
      .map((l) =>
        l.code === "99284"
          ? { ...l, insurerPaid: 0, patientResponsibility: 980 }
          : l.code === "70450"
            ? { ...l, insurerPaid: 472, patientResponsibility: 138 }
            : l,
      ),
    deductibleApplied: 1000,
    coinsuranceApplied: 182.8,
    totalPatientResponsibility: 1182.8,
  };

  it("returns no findings", () => {
    expect(runEngine(cleanBill, cleanEob, samplePlan)).toEqual([]);
  });
});

describe("runEngine without an EOB", () => {
  const findings = runEngine(sampleBill, null, samplePlan);

  it("still catches bill-only errors, with lower confidence", () => {
    expect(byType(findings)).toEqual({ duplicate_charge: 1420, quantity_anomaly: 225 });
    expect(findings.every((f) => f.confidence === "medium")).toBe(true);
  });
});

describe("bill above EOB with no matching line", () => {
  it("reports the unexplained gap as a generic finding", () => {
    const bill: Bill = { ...sampleBill, amountDue: sampleBill.amountDue + 73 };
    const gap = runEngine(bill, sampleEob, samplePlan).find(
      (f) => f.type === "bill_exceeds_eob",
    );
    expect(gap?.amount).toBe(235);
  });
});
