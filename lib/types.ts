/**
 * Domain types shared by the AI extraction layer, the rule engine and the UI.
 * All money values are US dollars as plain numbers (two decimals).
 */

/** What the user tells us about their insurance plan for this plan year. */
export interface PlanInfo {
  /** Annual individual deductible. */
  deductible: number;
  /** Deductible already paid this year BEFORE this visit. */
  deductibleMet: number;
  /** Patient share after deductible, in percent (20 means 20%). */
  coinsurancePct: number;
  /** Annual out-of-pocket maximum. */
  oopMax: number;
  /** Out-of-pocket already paid this year BEFORE this visit. */
  oopMet: number;
  /** Flat copay for this kind of visit (e.g. an ER copay). 0 if the plan has none. */
  copay: number;
  /** Was the provider in the plan's network? */
  inNetwork: boolean;
}

/** One line of an itemized provider bill. */
export interface BillLineItem {
  date: string; // ISO yyyy-mm-dd
  code: string; // CPT / HCPCS code, "" if the bill does not show one
  description: string;
  quantity: number;
  charge: number; // total for the line (unit price x quantity)
}

export interface Bill {
  provider: string;
  statementDate: string;
  lines: BillLineItem[];
  totalCharges: number;
  insurancePaid: number;
  adjustments: number;
  /** What the provider says the patient owes. */
  amountDue: number;
}

export type EobLineStatus = "paid" | "denied";

/** One line of the insurer's Explanation of Benefits. */
export interface EobLine {
  date: string;
  code: string;
  description: string;
  billed: number;
  allowed: number;
  insurerPaid: number;
  patientResponsibility: number;
  status: EobLineStatus;
  denialReason: string; // "" when paid
}

export interface Eob {
  insurer: string;
  claimNumber: string;
  lines: EobLine[];
  deductibleApplied: number;
  coinsuranceApplied: number;
  totalPatientResponsibility: number;
}

export type FindingType =
  | "duplicate_charge"
  | "quantity_anomaly"
  | "balance_billing"
  | "bill_exceeds_eob"
  | "plan_math"
  | "denied_claim"
  | "surprise_bill";

export type Confidence = "high" | "medium" | "low";

/** Who the user has to contact to fix the issue. */
export type FindingTarget = "provider" | "insurer";

export interface Finding {
  id: string;
  type: FindingType;
  title: string;
  /** Dollars the patient may not owe because of this issue. */
  amount: number;
  confidence: Confidence;
  target: FindingTarget;
  /** Plain-English explanation. Written by a template, optionally rewritten by AI. */
  explanation: string;
  /** Facts from the documents that support the finding. */
  evidence: string[];
  /** Billing codes of the bill lines this finding is about (for the annotated bill). */
  codes: string[];
}

export interface AnalysisMeta {
  /** Did an AI model read the documents (false = built-in sample data was used). */
  aiExtraction: boolean;
  /** Did an AI model write the explanations (false = template wording). */
  aiExplanations: boolean;
  model: string | null;
  hasEob: boolean;
}

export interface AnalysisResult {
  plan: PlanInfo;
  bill: Bill;
  eob: Eob | null;
  findings: Finding[];
  /** What the provider is asking for. */
  amountBilled: number;
  /** Sum of all finding amounts. */
  potentialSavings: number;
  /** amountBilled - potentialSavings, never below zero. */
  fairAmount: number;
  meta: AnalysisMeta;
}

/** Paid content, generated only after the payment is verified. */
export interface CaseLetters {
  providerLetter: string;
  insurerAppeal: string; // "" when there is nothing to appeal with the insurer
  callScript: string;
  /** Request for charity care, "" when the household does not look eligible. */
  assistanceLetter: string;
  aiWritten: boolean;
}
