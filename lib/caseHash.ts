import { createHash } from "node:crypto";
import type { Bill } from "./types";

/**
 * A fingerprint of the bill a case is about, so one payment opens one case.
 *
 * Only what defines the bill goes in: provider, statement date, the lines
 * (code, description, quantity, amount, date of service) and the amount due.
 * Findings, AI explanations, letters, the plan and household answers are
 * left out, so the same bill keeps the same hash across reloads and
 * re-checks. Server only: computed from data that passed resultSchema.
 */
export function caseHash(result: { bill: Bill }): string {
  return createHash("sha256").update(stableJson(caseIdentity(result.bill))).digest("hex");
}

const text = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const cents = (value: number) => Math.round(value * 100);

function caseIdentity(bill: Bill) {
  return {
    provider: text(bill.provider),
    statementDate: text(bill.statementDate),
    amountDue: cents(bill.amountDue),
    lines: bill.lines.map((line) => ({
      code: text(line.code),
      description: text(line.description),
      quantity: line.quantity,
      amount: cents(line.charge),
      date: text(line.date),
    })),
  };
}

/** JSON with object keys sorted at every level; array order is kept. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
