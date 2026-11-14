import type { Bill, Eob, PlanInfo } from "@/lib/types";

/**
 * A fully synthetic emergency-room case. No real person, hospital or insurer.
 * Five problems are planted in it; data/samples/README.md lists them.
 * The engine is tested against this file, the app never reads the answer key.
 */

export const samplePlan: PlanInfo = {
  deductible: 1500,
  deductibleMet: 500,
  coinsurancePct: 20,
  oopMax: 6000,
  oopMet: 500,
  inNetwork: true,
};

const DATE = "2026-09-18";

export const sampleBill: Bill = {
  provider: "Lakeview Regional Medical Center",
  statementDate: "2026-10-27",
  lines: [
    { date: DATE, code: "99284", description: "Emergency dept visit, level 4", quantity: 1, charge: 1850 },
    { date: DATE, code: "70450", description: "CT head without contrast", quantity: 1, charge: 1420 },
    { date: DATE, code: "70450", description: "CT head without contrast", quantity: 1, charge: 1420 },
    { date: DATE, code: "36415", description: "Venipuncture (blood draw)", quantity: 10, charge: 250 },
    { date: DATE, code: "85025", description: "Complete blood count", quantity: 1, charge: 96 },
    { date: DATE, code: "80053", description: "Comprehensive metabolic panel", quantity: 1, charge: 148 },
    { date: DATE, code: "93005", description: "Electrocardiogram, tracing", quantity: 1, charge: 210 },
    { date: DATE, code: "96374", description: "IV push, single drug", quantity: 1, charge: 320 },
    { date: DATE, code: "J1885", description: "Ketorolac injection, 15 mg", quantity: 2, charge: 64 },
    { date: DATE, code: "96361", description: "IV hydration, additional hour", quantity: 1, charge: 180 },
    { date: DATE, code: "71046", description: "Chest X-ray, 2 views", quantity: 1, charge: 340 },
  ],
  totalCharges: 6298,
  insurancePaid: 331.2,
  adjustments: 2237,
  amountDue: 3729.8,
};

export const sampleEob: Eob = {
  insurer: "Northstar Health Plan",
  claimNumber: "NS-2026-0918-44172",
  lines: [
    { date: DATE, code: "99284", description: "Emergency dept visit, level 4", billed: 1850, allowed: 980, insurerPaid: 0, patientResponsibility: 980, status: "paid", denialReason: "" },
    { date: DATE, code: "70450", description: "CT head without contrast", billed: 1420, allowed: 610, insurerPaid: 72, patientResponsibility: 538, status: "paid", denialReason: "" },
    { date: DATE, code: "36415", description: "Venipuncture (blood draw)", billed: 25, allowed: 8, insurerPaid: 6.4, patientResponsibility: 1.6, status: "paid", denialReason: "" },
    { date: DATE, code: "85025", description: "Complete blood count", billed: 96, allowed: 22, insurerPaid: 17.6, patientResponsibility: 4.4, status: "paid", denialReason: "" },
    { date: DATE, code: "80053", description: "Comprehensive metabolic panel", billed: 148, allowed: 31, insurerPaid: 24.8, patientResponsibility: 6.2, status: "paid", denialReason: "" },
    { date: DATE, code: "93005", description: "Electrocardiogram, tracing", billed: 210, allowed: 48, insurerPaid: 38.4, patientResponsibility: 9.6, status: "paid", denialReason: "" },
    { date: DATE, code: "96374", description: "IV push, single drug", billed: 320, allowed: 135, insurerPaid: 108, patientResponsibility: 27, status: "paid", denialReason: "" },
    { date: DATE, code: "J1885", description: "Ketorolac injection, 15 mg", billed: 64, allowed: 18, insurerPaid: 14.4, patientResponsibility: 3.6, status: "paid", denialReason: "" },
    { date: DATE, code: "96361", description: "IV hydration, additional hour", billed: 180, allowed: 62, insurerPaid: 49.6, patientResponsibility: 12.4, status: "paid", denialReason: "" },
    { date: DATE, code: "71046", description: "Chest X-ray, 2 views", billed: 340, allowed: 0, insurerPaid: 0, patientResponsibility: 340, status: "denied", denialReason: "Not deemed medically necessary" },
  ],
  deductibleApplied: 1500,
  coinsuranceApplied: 82.8,
  totalPatientResponsibility: 1922.8,
};
