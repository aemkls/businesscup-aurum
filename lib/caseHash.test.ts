import { describe, expect, it } from "vitest";
import { SAMPLES } from "@/data/samples";
import { runEngine, summarize } from "./engine";
import { caseHash, stableJson } from "./caseHash";
import type { AnalysisResult, Bill } from "./types";

function resultFor(kind: "er" | "physical"): AnalysisResult {
  const { bill, eob, plan } = SAMPLES[kind];
  const findings = runEngine(bill, eob, plan);
  return {
    plan,
    bill,
    eob,
    findings,
    ...summarize(bill, findings),
    meta: { hasEob: true, aiExtraction: true, aiExplanations: true, model: "gemini" },
  };
}

/** The same object with its keys in reverse order, at every level. */
function reversedKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reversedKeys) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .reverse()
        .map(([k, v]) => [k, reversedKeys(v)]),
    ) as T;
  }
  return value;
}

describe("caseHash", () => {
  const er = resultFor("er");

  it("is a sha256 hex string", () => {
    expect(caseHash(er)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not depend on the order of fields", () => {
    expect(caseHash(reversedKeys(er))).toBe(caseHash(er));
    expect(stableJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      stableJson({ a: { c: null, d: [2, 1] }, b: 1 }),
    );
  });

  it("ignores explanations, findings, the plan, the EOB and the AI flags", () => {
    const reworded: AnalysisResult = {
      ...er,
      plan: { ...er.plan, deductibleMet: er.plan.deductibleMet + 100 },
      eob: null,
      findings: er.findings.map((f) => ({ ...f, explanation: "Reworded by the AI.", evidence: [] })),
      potentialSavings: 1,
      meta: { hasEob: false, aiExtraction: false, aiExplanations: false, model: null },
    };
    expect(caseHash(reworded)).toBe(caseHash(er));
  });

  it("ignores spacing and letter case in the text fields", () => {
    const bill: Bill = {
      ...er.bill,
      provider: `  ${er.bill.provider.toUpperCase()} `,
      lines: er.bill.lines.map((l) => ({ ...l, description: l.description.replace(/ /g, "  ") })),
    };
    expect(caseHash({ bill })).toBe(caseHash(er));
  });

  it("differs between the ER and the physical sample", () => {
    expect(caseHash(resultFor("physical"))).not.toBe(caseHash(er));
  });

  it("changes when anything on the bill changes", () => {
    const line = er.bill.lines[0];
    const variants: Bill[] = [
      { ...er.bill, provider: "Another Hospital" },
      { ...er.bill, statementDate: "2026-01-01" },
      { ...er.bill, amountDue: er.bill.amountDue + 0.01 },
      { ...er.bill, lines: er.bill.lines.slice(1) },
      { ...er.bill, lines: [{ ...line, code: "99999" }, ...er.bill.lines.slice(1)] },
      { ...er.bill, lines: [{ ...line, quantity: line.quantity + 1 }, ...er.bill.lines.slice(1)] },
      { ...er.bill, lines: [{ ...line, charge: line.charge + 1 }, ...er.bill.lines.slice(1)] },
      { ...er.bill, lines: [{ ...line, date: "2020-01-01" }, ...er.bill.lines.slice(1)] },
      { ...er.bill, lines: [{ ...line, description: "Something else" }, ...er.bill.lines.slice(1)] },
    ];
    const hashes = new Set(variants.map((bill) => caseHash({ bill })));
    expect(hashes.size).toBe(variants.length);
    expect(hashes.has(caseHash(er))).toBe(false);
  });
});
