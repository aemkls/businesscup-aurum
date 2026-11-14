import type { AnalysisResult, Bill, Eob, Finding, PlanInfo } from "../types";
import { duplicateCharges, quantityAnomaly } from "./billRules";
import { billVersusEob, deniedClaims } from "./eobRules";
import { cents, sum } from "./money";
import { planMath } from "./planMath";
import { preventiveCare } from "./preventive";

/**
 * Runs every rule over the structured documents. Pure and deterministic:
 * the same bill, EOB and plan always produce the same findings and amounts.
 * The AI layer never touches these numbers.
 */
export function runEngine(bill: Bill, eob: Eob | null, plan: PlanInfo): Finding[] {
  const lineErrors = [...duplicateCharges(bill, eob), ...quantityAnomaly(bill, eob)];
  const explained = sum(lineErrors.map((f) => f.amount));

  const findings = [
    ...lineErrors,
    ...billVersusEob(bill, eob, plan, explained),
    ...planMath(eob, plan),
    ...deniedClaims(eob),
    ...preventiveCare(bill, eob, plan),
  ];
  // Money back first, by amount; "worth asking" (low confidence) after it.
  return findings.sort(
    (a, b) => Number(a.confidence === "low") - Number(b.confidence === "low") || b.amount - a.amount,
  );
}

export function summarize(
  bill: Bill,
  findings: Finding[],
): Pick<AnalysisResult, "amountBilled" | "potentialSavings" | "fairAmount"> {
  // Low-confidence findings are worth asking about but are not counted as money back.
  const counted = findings.filter((f) => f.confidence !== "low");
  const potentialSavings = Math.min(sum(counted.map((f) => f.amount)), bill.amountDue);
  return {
    amountBilled: bill.amountDue,
    potentialSavings,
    fairAmount: cents(Math.max(0, bill.amountDue - potentialSavings)),
  };
}
