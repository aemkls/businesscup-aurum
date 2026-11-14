import type { Eob, Finding, PlanInfo } from "../types";
import { cents, sum, usd } from "./money";

/**
 * What the patient should owe for a covered, in-network allowed amount:
 * first the remaining deductible, then coinsurance on the rest,
 * capped by what is left of the out-of-pocket maximum.
 */
export function expectedPatientShare(allowed: number, plan: PlanInfo): number {
  const deductibleLeft = Math.max(0, plan.deductible - plan.deductibleMet);
  const towardDeductible = Math.min(allowed, deductibleLeft);
  const coinsurance = (allowed - towardDeductible) * (plan.coinsurancePct / 100);
  const oopLeft = Math.max(0, plan.oopMax - plan.oopMet);
  return cents(Math.min(towardDeductible + coinsurance, oopLeft));
}

/**
 * Compares the insurer's cost-sharing on covered lines with what the plan
 * terms say it should be. Catches a deductible applied twice, the wrong
 * coinsurance rate, or an ignored out-of-pocket maximum.
 */
export function planMath(eob: Eob | null, plan: PlanInfo): Finding[] {
  if (!eob) return [];
  const covered = eob.lines.filter((l) => l.status === "paid");
  if (covered.length === 0) return [];

  const allowed = sum(covered.map((l) => l.allowed));
  const charged = sum(covered.map((l) => l.patientResponsibility));
  const expected = expectedPatientShare(allowed, plan);
  const diff = cents(charged - expected);
  if (diff <= 1) return [];

  const deductibleLeft = Math.max(0, plan.deductible - plan.deductibleMet);
  return [
    {
      id: "plan-math",
      type: "plan_math",
      title: "Your insurer's math does not match your plan",
      amount: diff,
      confidence: "high",
      target: "insurer",
      explanation:
        `Under your plan you should owe ${usd(expected)} on the covered services, ` +
        `but the EOB assigns you ${usd(charged)}. ` +
        (plan.deductibleMet > 0
          ? `You had already paid ${usd(plan.deductibleMet)} of your deductible this year, so only ${usd(deductibleLeft)} was left to apply.`
          : `Check the deductible and coinsurance the insurer applied.`),
      evidence: [
        `Allowed amount on covered lines: ${usd(allowed)}`,
        `Deductible left before this visit: ${usd(deductibleLeft)}`,
        `Coinsurance: ${plan.coinsurancePct}%`,
        `Deductible applied on the EOB: ${usd(eob.deductibleApplied)}`,
        `Expected patient share: ${usd(expected)}; EOB patient share: ${usd(charged)}`,
      ],
    },
  ];
}
