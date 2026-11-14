import type { Bill, Eob } from "./types";
import { usd } from "./engine/money";

/**
 * Renders structured documents as the plain text a patient would receive.
 * Used to send the sample case through the same AI reading step as an
 * uploaded file, so the demo exercises the real pipeline.
 */

export function billToText(bill: Bill): string {
  const rows = bill.lines.map(
    (l) =>
      `${l.date}  ${l.code.padEnd(6)} ${l.description.padEnd(34)} qty ${String(l.quantity).padStart(2)}  ${usd(l.charge)}`,
  );
  return [
    `${bill.provider.toUpperCase()} - ITEMIZED PATIENT STATEMENT`,
    `Statement date: ${bill.statementDate}`,
    "",
    ...rows,
    "",
    `Total charges: ${usd(bill.totalCharges)}`,
    `Insurance payments: -${usd(bill.insurancePaid)}`,
    `Insurance adjustments: -${usd(bill.adjustments)}`,
    `AMOUNT DUE FROM PATIENT: ${usd(bill.amountDue)}`,
  ].join("\n");
}

export function eobToText(eob: Eob): string {
  const rows = eob.lines.map(
    (l) =>
      `${l.date}  ${l.code.padEnd(6)} ${l.description.padEnd(34)} billed ${usd(l.billed)}  allowed ${usd(l.allowed)}  plan paid ${usd(l.insurerPaid)}  you owe ${usd(l.patientResponsibility)}` +
      (l.status === "denied" ? `  DENIED: ${l.denialReason}` : ""),
  );
  return [
    `${eob.insurer.toUpperCase()} - EXPLANATION OF BENEFITS (this is not a bill)`,
    `Claim number: ${eob.claimNumber}`,
    "",
    ...rows,
    "",
    `Deductible applied: ${usd(eob.deductibleApplied)}`,
    `Coinsurance: ${usd(eob.coinsuranceApplied)}`,
    `TOTAL PATIENT RESPONSIBILITY: ${usd(eob.totalPatientResponsibility)}`,
  ].join("\n");
}
