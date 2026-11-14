import type { Bill, BillLineItem, Eob, Finding } from "../types";
import { cents, usd } from "./money";

/**
 * Codes that are normally billed once per visit. A quantity above one on
 * these is a common keying error (10 instead of 1).
 */
const ONCE_PER_VISIT = new Set([
  "36415", // venipuncture
  "99281", "99282", "99283", "99284", "99285", // ER visit levels
  "93005", "93010", // ECG
  "85025", "85027", // CBC
  "80048", "80053", // metabolic panels
  "70450", "71045", "71046", // CT head, chest X-ray
  "96374", // IV push, initial
]);

function lineKey(l: BillLineItem): string {
  return `${l.date}|${l.code || l.description.toLowerCase()}|${l.charge}`;
}

function eobCount(eob: Eob | null, code: string): number | null {
  if (!eob || !code) return null;
  return eob.lines.filter((l) => l.code === code).length;
}

/** Identical lines (same date, code and charge) that appear more than once. */
export function duplicateCharges(bill: Bill, eob: Eob | null): Finding[] {
  const groups = new Map<string, BillLineItem[]>();
  for (const line of bill.lines) {
    const key = lineKey(line);
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  const findings: Finding[] = [];
  for (const lines of groups.values()) {
    if (lines.length < 2) continue;
    const first = lines[0];
    const onEob = eobCount(eob, first.code);
    // If the insurer processed the same number of lines, it is probably real.
    if (onEob !== null && onEob >= lines.length) continue;

    const extra = onEob === null ? lines.length - 1 : lines.length - Math.max(onEob, 1);
    const label = first.code ? `${first.code} ${first.description}` : first.description;
    findings.push({
      id: `duplicate-${first.code || findings.length}`,
      type: "duplicate_charge",
      title: `Charged ${lines.length} times for ${first.description}`,
      amount: cents(extra * first.charge),
      confidence: onEob === null ? "medium" : "high",
      target: "provider",
      explanation:
        `The bill lists "${label}" ${lines.length} times on ${first.date} at ${usd(first.charge)} each` +
        (onEob === null
          ? `. Identical lines on the same day are usually a duplicate entry.`
          : `, but your insurer processed it only ${onEob === 0 ? "zero times" : onEob === 1 ? "once" : `${onEob} times`}. The extra line looks like a duplicate.`),
      evidence: [
        `Bill: ${lines.length} x ${label} on ${first.date}, ${usd(first.charge)} each`,
        ...(onEob === null ? [] : [`EOB: ${onEob} line(s) with code ${first.code}`]),
      ],
    });
  }
  return findings;
}

/** A once-per-visit service billed with a quantity above one. */
export function quantityAnomaly(bill: Bill, eob: Eob | null): Finding[] {
  const findings: Finding[] = [];
  for (const line of bill.lines) {
    if (line.quantity <= 1 || !ONCE_PER_VISIT.has(line.code)) continue;
    const unit = cents(line.charge / line.quantity);

    // How many units did the insurer see? billed / unit price, when the line exists.
    const eobLine = eob?.lines.find((l) => l.code === line.code);
    const unitsOnEob = eobLine ? Math.max(1, Math.round(eobLine.billed / unit)) : null;
    if (unitsOnEob !== null && unitsOnEob >= line.quantity) continue;

    const expectedUnits = unitsOnEob ?? 1;
    findings.push({
      id: `quantity-${line.code}`,
      type: "quantity_anomaly",
      title: `${line.quantity} units of ${line.description}`,
      amount: cents((line.quantity - expectedUnits) * unit),
      confidence: unitsOnEob === null ? "medium" : "high",
      target: "provider",
      explanation:
        `"${line.code} ${line.description}" is normally billed once per visit, ` +
        `but the bill shows a quantity of ${line.quantity} (${usd(line.charge)}). ` +
        (unitsOnEob === null
          ? `Ask the billing office to confirm the units against your medical record.`
          : `Your insurer was billed for ${expectedUnits}. The other ${line.quantity - expectedUnits} look like a keying error.`),
      evidence: [
        `Bill: ${line.code} x ${line.quantity} = ${usd(line.charge)} (${usd(unit)} each)`,
        ...(eobLine ? [`EOB: ${line.code} billed ${usd(eobLine.billed)}`] : []),
      ],
    });
  }
  return findings;
}
