"use client";

import { usd } from "@/lib/engine/money";
import type { Bill, Finding } from "@/lib/types";

const SHORT: Record<Finding["type"], string> = {
  duplicate_charge: "Duplicate",
  quantity_anomaly: "Wrong quantity",
  balance_billing: "Above insurer rate",
  bill_exceeds_eob: "Above EOB",
  plan_math: "Plan math",
  denied_claim: "Denied, appealable",
  surprise_bill: "Surprise bill",
};

interface Mark {
  number: number;
  label: string;
}

/**
 * Maps each bill line to the findings about it. For duplicates only the
 * repeated lines are marked, so the first (legitimate) one stays clean.
 */
function markLines(bill: Bill, findings: Finding[]): Mark[][] {
  const marks: Mark[][] = bill.lines.map(() => []);
  findings.forEach((finding, i) => {
    const mark = { number: i + 1, label: SHORT[finding.type] };
    const seen = new Map<string, number>();
    bill.lines.forEach((line, row) => {
      if (!line.code || !finding.codes.includes(line.code)) return;
      const count = (seen.get(line.code) ?? 0) + 1;
      seen.set(line.code, count);
      if (finding.type === "duplicate_charge" && count === 1) return;
      marks[row].push(mark);
    });
  });
  return marks;
}

/** The user's own bill, line by line, with the problem lines marked. */
export function BillXray({ bill, findings }: { bill: Bill; findings: Finding[] }) {
  const marks = markLines(bill, findings);
  const flagged = marks.filter((m) => m.length > 0).length;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Your bill, line by line</h2>
        <span className="text-sm text-muted">
          {flagged} of {bill.lines.length} lines flagged
        </span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2 font-normal">Code</th>
              <th className="px-4 py-2 font-normal">Service</th>
              <th className="px-4 py-2 text-right font-normal">Qty</th>
              <th className="px-4 py-2 text-right font-normal">Charge</th>
              <th className="px-4 py-2 font-normal">Issue</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((line, row) => {
              const lineMarks = marks[row];
              const bad = lineMarks.length > 0;
              return (
                <tr
                  key={row}
                  className={`border-b border-line last:border-0 ${bad ? "bg-warn-soft" : ""}`}
                >
                  <td className="money px-4 py-2 text-muted">{line.code || "-"}</td>
                  <td className={`px-4 py-2 ${bad ? "font-medium" : ""}`}>{line.description}</td>
                  <td className="money px-4 py-2 text-right">{line.quantity}</td>
                  <td className={`money px-4 py-2 text-right ${bad ? "text-warn" : ""}`}>
                    {usd(line.charge)}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap gap-1">
                      {lineMarks.map((mark) => (
                        <span
                          key={mark.number}
                          className="whitespace-nowrap rounded bg-warn px-1.5 py-0.5 text-xs text-white"
                        >
                          <span className="money">{String(mark.number).padStart(2, "0")}</span>{" "}
                          {mark.label}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
