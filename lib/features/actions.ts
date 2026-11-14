import { assistanceTier, fplPercent, type Household } from "../engine/assistance";
import { usd } from "../engine/money";
import type { AnalysisResult, BillLineItem } from "../types";
import { decodeDenial, type DenialAdvice } from "./denials";
import {
  debtValidationRequest,
  facilityFeeReview,
  goodFaithEstimateDispute,
  itemizedBillRequest,
  recallFromCollections,
} from "./extraLetters";
import { addDays, type Situation } from "./situation";

/**
 * The action plan: what to do next, in order, beyond the dispute letters.
 * Built only from the case and the user's answers, entirely in the browser,
 * so it adds no server work.
 */

export type ActionKind =
  | "itemized_bill"
  | "never_billed"
  | "denial_fix"
  | "facility_fee"
  | "good_faith_estimate"
  | "collections"
  | "before_you_pay"
  | "assistance";

export interface Action {
  id: string;
  kind: ActionKind;
  title: string;
  why: string;
  steps: string[];
  /** Hard deadline, ISO date, when one applies. */
  deadline: { date: string; label: string } | null;
  /** A ready letter for this action, or null. */
  letter: { title: string; text: string } | null;
  /** For denial actions: the decoded denial. */
  denial: DenialAdvice | null;
  /** Lower comes first. */
  priority: number;
}

const FACILITY_CODES = new Set(["G0463", "G0466", "G0467", "G0468"]);
const FACILITY_WORDS = /facility fee|hospital outpatient clinic|clinic visit,? hospital|provider[- ]based/i;

function facilityLines(lines: BillLineItem[]): BillLineItem[] {
  return lines.filter((l) => FACILITY_CODES.has(l.code) || FACILITY_WORDS.test(l.description));
}

export function buildActionPlan(
  result: AnalysisResult,
  situation: Situation,
  household: Household | null = null,
): Action[] {
  const { bill, eob } = result;
  const actions: Action[] = [];

  // 1. A summary bill hides everything. The single most repeated advice from patients: ask for the itemized bill.
  const uncoded = bill.lines.filter((l) => !l.code).length;
  if (bill.lines.length <= 2 || uncoded / Math.max(1, bill.lines.length) > 0.5) {
    actions.push({
      id: "itemized-bill",
      kind: "itemized_bill",
      title: "Ask for the itemized bill before paying anything",
      why: "This looks like a summary bill. Errors hide in the line items, and most hospitals send them only when asked.",
      steps: [
        "Send the request letter or call billing and ask for an itemized bill with CPT codes.",
        "Ask them to hold the account while you wait.",
        "Run the check again when it arrives.",
      ],
      deadline: null,
      letter: { title: "Itemized bill request", text: itemizedBillRequest(bill) },
      denial: null,
      priority: 0,
    });
  }

  // 2. No EOB and no insurance payment: the provider may never have billed the insurer.
  if (!situation.selfPay && !eob && bill.insurancePaid === 0 && bill.adjustments === 0) {
    actions.push({
      id: "never-billed",
      kind: "never_billed",
      title: "Make sure your insurance was billed",
      why: "The bill shows no insurance payment and no insurance discount. That usually means the claim never reached your insurer.",
      steps: [
        "Look for this visit in your insurer's portal. No claim means it was never filed.",
        "Send the provider your current insurance card and ask them to bill it.",
        "If they say it is too late to file, ask your insurer whether an in-network provider can bill you for a claim they never sent.",
      ],
      deadline: null,
      letter: null,
      denial: null,
      priority: 1,
    });
  }

  // 3. Denials, decoded into the fastest fix.
  for (const line of eob?.lines ?? []) {
    if (line.status !== "denied") continue;
    const advice = decodeDenial(line.denialReason);
    const from = situation.denialNoticeDate;
    actions.push({
      id: `denial-${line.code}`,
      kind: "denial_fix",
      title: `${advice.label}: ${line.description}`,
      why: `${advice.meaning} You are being asked to pay ${usd(line.patientResponsibility)}.`,
      steps: [advice.fastestFix, ...advice.steps],
      deadline: advice.appeal
        ? from
          ? { date: addDays(from, 180), label: "Internal appeal deadline (180 days from the denial notice)" }
          : null
        : null,
      letter: null,
      denial: advice,
      priority: 2,
    });
  }

  // 4. Hospital facility fee at a clinic.
  const facility = facilityLines(bill.lines);
  if (facility.length > 0) {
    const total = facility.reduce((a, l) => a + l.charge, 0);
    actions.push({
      id: "facility-fee",
      kind: "facility_fee",
      title: `Question the ${usd(total)} hospital facility fee`,
      why: "Clinics owned by a hospital can add a facility fee to a regular doctor's visit. More than 20 states now regulate these fees, and many patients were never told in advance.",
      steps: [
        "Ask billing for the written notice they gave you before the visit.",
        "Send the review letter asking them to remove or reduce the fee.",
        "Next time, ask when booking whether the clinic bills as a hospital outpatient department.",
      ],
      deadline: null,
      letter: { title: "Facility fee review", text: facilityFeeReview(bill, facility) },
      denial: null,
      priority: 3,
    });
  }

  // 5. Self-pay bill above the Good Faith Estimate.
  if (situation.selfPay && situation.goodFaithEstimate !== null) {
    const over = bill.amountDue - situation.goodFaithEstimate;
    if (over >= 400) {
      actions.push({
        id: "good-faith-estimate",
        kind: "good_faith_estimate",
        title: `Your bill is ${usd(over)} above your Good Faith Estimate`,
        why: "Self-pay patients billed at least $400 above their written estimate can use a federal dispute process. A neutral reviewer decides what you owe; the fee is $25.",
        steps: [
          "Send the letter asking the provider to honor the estimate.",
          "If they refuse, start the patient-provider dispute at cms.gov/nosurprises with the estimate and the bill.",
          "Do not pay the disputed amount while the dispute is open.",
        ],
        deadline: bill.statementDate
          ? { date: addDays(bill.statementDate, 120), label: "Federal dispute deadline (120 days from the bill date)" }
          : null,
        letter: { title: "Good Faith Estimate dispute", text: goodFaithEstimateDispute(bill, situation.goodFaithEstimate) },
        denial: null,
        priority: 1,
      });
    }
  }

  // 6. Collections: validation, recall, and the credit report rules.
  if (situation.inCollections) {
    const small = bill.amountDue < 500;
    actions.push({
      id: "collections",
      kind: "collections",
      title: "Protect your credit while you dispute",
      why: small
        ? "Under the credit bureaus' current policy, medical collections under $500 do not appear on credit reports. You can dispute calmly."
        : "Under the credit bureaus' current policy, unpaid medical debt cannot appear on your credit report until it is a year past due, and paid medical collections are removed. Use that time.",
      steps: [
        "Send the validation letter to the collector within 30 days of their first notice.",
        "Ask the hospital to recall the account from collections while the dispute is open.",
        "If a medical collection under $500 or a paid one shows up on your report, dispute it with the credit bureau.",
      ],
      deadline: situation.collectionNoticeDate
        ? { date: addDays(situation.collectionNoticeDate, 30), label: "Ask for validation (30 days from the collector's first notice)" }
        : null,
      letter: {
        title: "Debt validation request and recall request",
        text: `${debtValidationRequest(bill)}\n\n— — —\n\n${recallFromCollections(bill, eob)}`,
      },
      denial: null,
      priority: 1,
    });
  }

  // 7. Financial assistance, when the household answers suggest it.
  if (household && assistanceTier(fplPercent(household)) !== "unlikely") {
    actions.push({
      id: "assistance",
      kind: "assistance",
      title: "Apply for the hospital's financial assistance",
      why: "Nonprofit hospitals must have a financial assistance policy, and your income is in the range where many give free or discounted care.",
      steps: [
        "Send the assistance request letter from your documents.",
        "Return the application with proof of income as soon as it arrives.",
        "Ask them to apply the assistance to the corrected balance.",
      ],
      deadline: null,
      letter: null,
      denial: null,
      priority: 2,
    });
  }

  // 8. Always: how to pay safely, once the right amount is known.
  if (bill.amountDue > 0) {
    actions.push({
      id: "before-you-pay",
      kind: "before_you_pay",
      title: "When it is time to pay, pay the right way",
      why: "Medical debt has protections that credit card debt does not. Moving it onto a card or a medical credit card gives them up.",
      steps: [
        "Pay only the undisputed part until the corrections come back.",
        "Ask for an interest-free payment plan, or a discount for paying the corrected balance at once.",
        "Avoid medical credit cards with deferred interest: if any balance is left when the promo ends, interest is charged back to day one.",
        "Use HSA or FSA money if you have it.",
      ],
      deadline: null,
      letter: null,
      denial: null,
      priority: 9,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}
