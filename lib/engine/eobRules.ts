import type { Bill, Eob, Finding, PlanInfo } from "../types";
import { cents, usd } from "./money";

/** Emergency department visit levels 1 to 5, plus critical care. */
const EMERGENCY_CODES = new Set(["99281", "99282", "99283", "99284", "99285", "99291"]);

function hasEmergencyVisit(bill: Bill): boolean {
  return bill.lines.some((l) => EMERGENCY_CODES.has(l.code));
}

/**
 * A line the insurer refused to pay and pushed to the patient.
 * These can be appealed; most people never do.
 */
export function deniedClaims(eob: Eob | null): Finding[] {
  if (!eob) return [];
  return eob.lines
    .filter(
      (l) =>
        l.patientResponsibility > 0 &&
        (l.status === "denied" || (l.insurerPaid === 0 && l.allowed === 0 && l.billed > 0)),
    )
    .map((l, i) => ({
      id: `denied-${l.code || i}`,
      type: "denied_claim" as const,
      title: `Denied: ${l.description}`,
      amount: cents(l.patientResponsibility),
      confidence: "medium" as const,
      target: "insurer" as const,
      explanation:
        `Your insurer denied "${l.code} ${l.description}" and left you with ${usd(l.patientResponsibility)}` +
        (l.denialReason ? ` (reason given: "${l.denialReason}")` : "") +
        `. You have the right to an internal appeal, normally within 180 days of the denial notice.`,
      evidence: [
        `EOB: ${l.code} billed ${usd(l.billed)}, insurer paid ${usd(l.insurerPaid)}, you owe ${usd(l.patientResponsibility)}`,
        ...(l.denialReason ? [`Denial reason: ${l.denialReason}`] : []),
      ],
      codes: [l.code],
    }));
}

/**
 * Whatever the bill asks for above the EOB's patient responsibility, after
 * the line-level bill errors are taken out. If that remainder equals the
 * insurer discount (billed - allowed) on one line, the provider skipped the
 * contractual write-off on it, which is balance billing.
 */
export function billVersusEob(
  bill: Bill,
  eob: Eob | null,
  plan: PlanInfo,
  alreadyExplained: number,
): Finding[] {
  if (!eob) return [];
  const gap = cents(bill.amountDue - eob.totalPatientResponsibility - alreadyExplained);
  if (gap <= 1) return [];

  const evidence = [
    `Bill amount due: ${usd(bill.amountDue)}`,
    `EOB patient responsibility: ${usd(eob.totalPatientResponsibility)}`,
    ...(alreadyExplained > 0
      ? [`Explained by the line errors above: ${usd(alreadyExplained)}`]
      : []),
  ];

  const skipped = eob.lines.find(
    (l) => l.status === "paid" && Math.abs(cents(l.billed - l.allowed) - gap) <= 1,
  );
  if (skipped && plan.inNetwork) {
    return [
      {
        id: `balance-${skipped.code}`,
        type: "balance_billing",
        title: `Billed above the insurer's rate for ${skipped.description}`,
        amount: gap,
        confidence: "high",
        target: "provider",
        explanation:
          `Your insurer's contracted rate for "${skipped.code} ${skipped.description}" is ${usd(skipped.allowed)}, ` +
          `but the provider charged ${usd(skipped.billed)} and passed the ${usd(gap)} difference on to you. ` +
          `In-network providers agree to write that difference off.`,
        evidence: [
          ...evidence,
          `EOB: ${skipped.code} billed ${usd(skipped.billed)}, allowed ${usd(skipped.allowed)}`,
        ],
        codes: [skipped.code],
      },
    ];
  }

  if (!plan.inNetwork && hasEmergencyVisit(bill)) {
    return [
      {
        id: "surprise-bill",
        type: "surprise_bill",
        title: "Out-of-network emergency care billed above your EOB",
        amount: gap,
        confidence: "high",
        target: "provider",
        explanation:
          `This was an emergency visit with an out-of-network provider. Under the federal No Surprises Act, ` +
          `the provider can charge you only the in-network cost sharing shown on your EOB (${usd(eob.totalPatientResponsibility)}), ` +
          `not the ${usd(gap)} balance on top of it.`,
        evidence: [...evidence, "Emergency visit code on the bill; provider marked out-of-network"],
        codes: bill.lines.filter((l) => EMERGENCY_CODES.has(l.code)).map((l) => l.code),
      },
    ];
  }

  return [
    {
      id: "bill-exceeds-eob",
      type: "bill_exceeds_eob",
      title: "The bill asks for more than your EOB says you owe",
      amount: gap,
      confidence: plan.inNetwork ? "high" : "medium",
      target: "provider",
      explanation:
        `Your EOB puts your share at ${usd(eob.totalPatientResponsibility)}, but the provider is asking for ${usd(bill.amountDue)}. ` +
        `${usd(gap)} of that is not explained by anything on the EOB.` +
        (plan.inNetwork
          ? ""
          : ` Out-of-network providers can sometimes bill the difference, so ask them to itemize it.`),
      evidence,
      codes: [],
    },
  ];
}
