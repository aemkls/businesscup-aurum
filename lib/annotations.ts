import { cents } from "./engine/money";
import type { Bill, Finding } from "./types";

/**
 * Turns the engine's findings into the marks an auditor would put on the
 * paper bill: which lines get the yellow marker, what the red pen strikes
 * out or corrects, and the short note in the margin. It only reads the
 * findings; every amount still comes from the rule engine.
 */

export interface LineMark {
  /** Index of the finding in the findings list (shown as its number). */
  finding: number;
  /** Short handwritten note, e.g. "billed twice". */
  note: string;
  /** Strike the whole line out (a duplicate). */
  strikeLine: boolean;
  /** Quantity correction, e.g. 10 -> 1. */
  quantity: { from: number; to: number } | null;
  /** Corrected line amount, when the pen rewrites it. */
  correctedCharge: number | null;
}

export interface LooseNote {
  finding: number;
  note: string;
  amount: number;
}

export interface BillMarkup {
  /** One entry per bill line; null when the line is fine. */
  lines: (LineMark | null)[];
  /** Findings about the bill as a whole (plan math, EOB gaps). */
  loose: LooseNote[];
  /** The handwritten total next to the struck-out amount due, or null. */
  correctedTotal: number | null;
}

const NOTE: Record<Finding["type"], string> = {
  duplicate_charge: "billed twice",
  quantity_anomaly: "should be 1",
  balance_billing: "above insurer rate",
  bill_exceeds_eob: "more than EOB says",
  plan_math: "insurer math is off",
  denied_claim: "insurer denied — appeal",
  surprise_bill: "surprise bill",
  preventive_cost_sharing: "preventive = $0",
  split_visit: "split visit?",
};

export function markUpBill(bill: Bill, findings: Finding[], fairAmount: number): BillMarkup {
  const lines: (LineMark | null)[] = bill.lines.map(() => null);
  const loose: LooseNote[] = [];

  findings.forEach((finding, index) => {
    let marked = false;
    const seen = new Map<string, number>();
    bill.lines.forEach((line, row) => {
      if (!line.code || !finding.codes.includes(line.code) || lines[row]) return;
      const count = (seen.get(line.code) ?? 0) + 1;
      seen.set(line.code, count);
      // For a duplicate, the first line is the real one: mark only the repeats.
      if (finding.type === "duplicate_charge" && count === 1) return;

      let quantity: LineMark["quantity"] = null;
      let correctedCharge: number | null = null;
      let note = NOTE[finding.type];
      if (finding.type === "quantity_anomaly" && line.quantity > 1) {
        const unit = line.charge / line.quantity;
        const extraUnits = Math.round(finding.amount / unit);
        const to = Math.max(1, line.quantity - extraUnits);
        quantity = { from: line.quantity, to };
        correctedCharge = cents(line.charge - finding.amount);
        note = `should be ${to}`;
      }
      lines[row] = {
        finding: index,
        note,
        strikeLine: finding.type === "duplicate_charge",
        quantity,
        correctedCharge,
      };
      marked = true;
    });
    if (!marked) loose.push({ finding: index, note: NOTE[finding.type], amount: finding.amount });
  });

  return { lines, loose, correctedTotal: findings.length > 0 ? fairAmount : null };
}
