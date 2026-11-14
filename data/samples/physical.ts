import type { Bill, Eob, PlanInfo } from "@/lib/types";

/**
 * Second synthetic case: a "free" annual physical that came back with a bill.
 * Modeled on the most common story patients post about preventive care:
 * a copay on the physical itself, a screening lab billed as diagnostic,
 * a second "problem" visit for a question asked in the room, and a hospital
 * facility fee at a clinic that looks like a regular doctor's office.
 * No real person, clinic or insurer.
 */

export const physicalPlan: PlanInfo = {
  deductible: 2000,
  deductibleMet: 0,
  coinsurancePct: 20,
  copay: 0,
  oopMax: 7000,
  oopMet: 0,
  inNetwork: true,
};

const DATE = "2026-08-04";

export const physicalBill: Bill = {
  provider: "Maple Grove Primary Care, a Riverside Health clinic",
  statementDate: "2026-09-02",
  lines: [
    { date: DATE, code: "99395", description: "Preventive visit, age 18-39", quantity: 1, charge: 285 },
    { date: DATE, code: "99213", description: "Office visit, established patient", quantity: 1, charge: 210 },
    { date: DATE, code: "80053", description: "Comprehensive metabolic panel", quantity: 1, charge: 148 },
    { date: DATE, code: "80061", description: "Lipid panel", quantity: 1, charge: 96 },
    { date: DATE, code: "85025", description: "Complete blood count", quantity: 1, charge: 64 },
    { date: DATE, code: "36415", description: "Venipuncture (blood draw)", quantity: 1, charge: 25 },
    { date: DATE, code: "G0463", description: "Hospital outpatient clinic visit", quantity: 1, charge: 240 },
  ],
  totalCharges: 1068,
  insurancePaid: 145,
  adjustments: 516,
  amountDue: 407,
};

export const physicalEob: Eob = {
  insurer: "Northstar Health Plan",
  claimNumber: "NS-2026-0804-20931",
  lines: [
    { date: DATE, code: "99395", description: "Preventive visit, age 18-39", billed: 285, allowed: 190, insurerPaid: 145, patientResponsibility: 45, status: "paid", denialReason: "" },
    { date: DATE, code: "99213", description: "Office visit, established patient", billed: 210, allowed: 112, insurerPaid: 0, patientResponsibility: 112, status: "paid", denialReason: "" },
    { date: DATE, code: "80053", description: "Comprehensive metabolic panel", billed: 148, allowed: 31, insurerPaid: 0, patientResponsibility: 31, status: "paid", denialReason: "" },
    { date: DATE, code: "80061", description: "Lipid panel", billed: 96, allowed: 28, insurerPaid: 0, patientResponsibility: 28, status: "paid", denialReason: "" },
    { date: DATE, code: "85025", description: "Complete blood count", billed: 64, allowed: 18, insurerPaid: 0, patientResponsibility: 18, status: "paid", denialReason: "" },
    { date: DATE, code: "36415", description: "Venipuncture (blood draw)", billed: 25, allowed: 8, insurerPaid: 0, patientResponsibility: 8, status: "paid", denialReason: "" },
    { date: DATE, code: "G0463", description: "Hospital outpatient clinic visit", billed: 240, allowed: 165, insurerPaid: 0, patientResponsibility: 165, status: "paid", denialReason: "" },
  ],
  deductibleApplied: 362,
  coinsuranceApplied: 0,
  totalPatientResponsibility: 407,
};
