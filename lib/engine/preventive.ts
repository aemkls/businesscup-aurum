import type { Bill, Eob, Finding, PlanInfo } from "../types";
import { cents, sum, usd } from "./money";

/**
 * Preventive care checks.
 *
 * Under the Affordable Care Act, most plans must cover recommended preventive
 * services in-network with no cost sharing. The most common complaint we read
 * from patients: a "free" annual physical that comes back with a copay or a
 * lab bill, either because a service was coded as diagnostic or because the
 * visit was split into a physical plus a problem visit.
 */

/** Preventive visits and screenings that are $0 in-network on ACA plans. */
export const PREVENTIVE_CODES = new Map<string, string>([
  ...["99381", "99382", "99383", "99384", "99385", "99386", "99387"].map(
    (c) => [c, "new-patient preventive visit"] as [string, string],
  ),
  ...["99391", "99392", "99393", "99394", "99395", "99396", "99397"].map(
    (c) => [c, "preventive visit"] as [string, string],
  ),
  ["G0438", "Medicare annual wellness visit"],
  ["G0439", "Medicare annual wellness visit"],
  ["77067", "screening mammogram"],
  ["G0121", "screening colonoscopy"],
  ["G0105", "screening colonoscopy"],
]);

/**
 * Tests that are preventive only when billed with a screening diagnosis.
 * If one shows cost sharing next to a preventive visit, the fix is usually a
 * corrected claim with the screening diagnosis.
 */
export const SCREENING_IF_CODED = new Map<string, string>([
  ["80061", "cholesterol panel"],
  ["82947", "glucose test"],
  ["83036", "A1c diabetes test"],
  ["86803", "hepatitis C screening"],
  ["87491", "chlamydia test"],
  ["87591", "gonorrhea test"],
  ["86703", "HIV screening"],
]);

/** Office visits for a problem (new and established patients). */
const PROBLEM_VISITS = new Set([
  "99202", "99203", "99204", "99205", "99211", "99212", "99213", "99214", "99215",
]);

export function isPreventiveCode(code: string): boolean {
  return PREVENTIVE_CODES.has(code);
}

export function preventiveCare(bill: Bill, eob: Eob | null, plan: PlanInfo): Finding[] {
  if (!plan.inNetwork) return [];
  const findings: Finding[] = [];
  const preventiveDates = new Set(
    [...bill.lines, ...(eob?.lines ?? [])]
      .filter((l) => isPreventiveCode(l.code))
      .map((l) => l.date),
  );

  // 1. A preventive service with patient cost sharing on the EOB.
  for (const line of eob?.lines ?? []) {
    const name = PREVENTIVE_CODES.get(line.code);
    if (!name || line.status !== "paid" || line.patientResponsibility <= 0) continue;
    findings.push({
      id: `preventive-${line.code}`,
      type: "preventive_cost_sharing",
      title: `You were charged for a ${name}`,
      amount: cents(line.patientResponsibility),
      confidence: "high",
      target: "insurer",
      explanation:
        `"${line.code} ${line.description}" is a ${name}. In-network preventive care is covered with no cost sharing ` +
        `under the Affordable Care Act on most plans, but your EOB assigns you ${usd(line.patientResponsibility)}. ` +
        `Ask your insurer to reprocess it as preventive.`,
      evidence: [
        `EOB: ${line.code} allowed ${usd(line.allowed)}, you owe ${usd(line.patientResponsibility)}`,
        "Provider marked in-network",
      ],
      codes: [line.code],
    });
  }

  // 2. A screening test billed with cost sharing on the same day as a physical.
  for (const line of eob?.lines ?? []) {
    const name = SCREENING_IF_CODED.get(line.code);
    if (!name || line.status !== "paid" || line.patientResponsibility <= 0) continue;
    if (!preventiveDates.has(line.date)) continue;
    findings.push({
      id: `screening-${line.code}`,
      type: "preventive_cost_sharing",
      title: `A screening ${name} was billed as diagnostic`,
      amount: cents(line.patientResponsibility),
      confidence: "medium",
      target: "provider",
      explanation:
        `You had a ${name} (${line.code}) at your preventive visit and were charged ${usd(line.patientResponsibility)}. ` +
        `When it is ordered as a routine screening, it is usually free in-network. Ask the office whether it was ` +
        `coded with a screening diagnosis; if not, ask them to send a corrected claim.`,
      evidence: [`EOB: ${line.code} on ${line.date}, you owe ${usd(line.patientResponsibility)}`],
      codes: [line.code],
    });
  }

  // 3. A problem visit billed on the same day as a physical.
  const problem = (eob?.lines ?? bill.lines).filter(
    (l) => PROBLEM_VISITS.has(l.code) && preventiveDates.has(l.date),
  );
  for (const line of problem) {
    const owed =
      "patientResponsibility" in line ? (line as { patientResponsibility: number }).patientResponsibility : 0;
    findings.push({
      id: `split-${line.code}-${line.date}`,
      type: "split_visit",
      title: "Your physical was billed as two visits",
      amount: cents(owed),
      confidence: "low",
      target: "provider",
      explanation:
        `Next to your preventive visit, the office billed a separate problem visit (${line.code}). This is allowed ` +
        `when the doctor treated a new or ongoing problem, but it is often added for a quick question. ` +
        `Ask for the visit notes; if you only discussed routine topics, ask them to remove the extra visit.`,
      evidence: [
        `Same date ${line.date}: preventive visit and ${line.code} ${line.description}`,
        ...(owed > 0 ? [`EOB: you owe ${usd(owed)} for ${line.code}`] : []),
      ],
      codes: [line.code],
    });
  }
  return findings;
}

/** Sum of allowed amounts on preventive lines, excluded from deductible math. */
export function preventiveAllowed(eob: Eob): number {
  return sum(eob.lines.filter((l) => isPreventiveCode(l.code)).map((l) => l.allowed));
}
