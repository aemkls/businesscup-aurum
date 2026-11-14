"use client";

import { usd } from "@/lib/engine/money";
import type { Bill, Finding } from "@/lib/types";
import { findingNumber, SHORT_LABEL } from "./results/findingLabels";
import { Chip } from "./ui";

/**
 * Maps each bill line to the indexes of the findings about it. For
 * duplicates only the repeated lines are marked, so the first (legitimate)
 * one stays clean.
 */
function markLines(bill: Bill, findings: Finding[]): number[][] {
  const marks: number[][] = bill.lines.map(() => []);
  findings.forEach((finding, i) => {
    const seen = new Map<string, number>();
    bill.lines.forEach((line, row) => {
      if (!line.code || !finding.codes.includes(line.code)) return;
      const count = (seen.get(line.code) ?? 0) + 1;
      seen.set(line.code, count);
      if (finding.type === "duplicate_charge" && count === 1) return;
      marks[row].push(i);
    });
  });
  return marks;
}

/**
 * The user's own bill, line by line, with the problem lines marked.
 * Selecting a finding highlights its lines; clicking a flagged line selects
 * its finding.
 */
export function BillXray({
  bill,
  findings,
  selected,
  onSelect,
}: {
  bill: Bill;
  findings: Finding[];
  selected: string | null;
  onSelect: (findingId: string | null) => void;
}) {
  const marks = markLines(bill, findings);
  const flagged = marks.filter((m) => m.length > 0).length;
  const selectedIndex = findings.findIndex((f) => f.id === selected);
  const current = selectedIndex >= 0 ? findings[selectedIndex] : null;
  // Findings without bill lines (plan math, EOB gaps) can still be selected from the list.
  const lineFindings = findings.map((f, i) => ({ f, i }));

  return (
    <div>
      <p className="text-caption text-ink-muted">
        {flagged} of {bill.lines.length} lines flagged. Select a finding to see its lines, or a
        flagged line to see what is wrong with it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Findings">
        {lineFindings.map(({ f, i }) => {
          const on = f.id === selected;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? null : f.id)}
              className={`rounded-full px-3 py-1.5 text-caption ${
                on ? "bg-primary text-white" : "bg-parchment text-ink hover:text-primary"
              }`}
            >
              <span className="money">{findingNumber(i)}</span> {SHORT_LABEL[f.type]}{" "}
              <span className="money">{usd(f.amount)}</span>
            </button>
          );
        })}
      </div>

      {current && (
        <div className="mt-4 rounded-[18px] bg-parchment p-5" aria-live="polite">
          <p className="text-body font-semibold">
            <span className="money mr-2 text-ink-muted">{findingNumber(selectedIndex)}</span>
            {current.title}
          </p>
          <p className="mt-1 text-caption text-ink-muted">{current.explanation}</p>
          {current.codes.length === 0 && (
            <p className="mt-2 text-caption text-ink-muted">
              This one is about your plan or EOB as a whole, not a single bill line.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-[18px] border border-hairline">
        <table className="w-full text-caption">
          <thead>
            <tr className="border-b border-hairline text-left text-fine text-ink-muted">
              <th className="px-4 py-3 font-normal">Service</th>
              <th className="px-4 py-3 text-right font-normal">Qty</th>
              <th className="px-4 py-3 text-right font-normal">Charge</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((line, row) => {
              const lineMarks = marks[row];
              const bad = lineMarks.length > 0;
              const active = selectedIndex >= 0 && lineMarks.includes(selectedIndex);
              return (
                <tr
                  key={row}
                  aria-selected={active}
                  tabIndex={bad ? 0 : undefined}
                  onClick={bad ? () => onSelect(findings[lineMarks[0]].id) : undefined}
                  onKeyDown={
                    bad
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(findings[lineMarks[0]].id);
                          }
                        }
                      : undefined
                  }
                  className={`border-b border-hairline last:border-0 ${
                    bad ? "cursor-pointer bg-flag-soft" : ""
                  } ${active ? "outline outline-2 -outline-offset-2 outline-primary" : ""}`}
                >
                  <td className="px-4 py-3 align-top">
                    <span className="block">{line.description}</span>
                    <span className="money mt-0.5 block text-fine text-ink-muted">
                      {line.code || "No code"} · {line.date}
                    </span>
                    {bad && (
                      <span className="mt-2 flex flex-wrap gap-1">
                        {lineMarks.map((i) => (
                          <Chip key={i} tone="flag">
                            <span className="money">{findingNumber(i)}</span> {SHORT_LABEL[findings[i].type]}
                          </Chip>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="money px-4 py-3 text-right align-top">{line.quantity}</td>
                  <td className={`money px-4 py-3 text-right align-top ${bad ? "font-semibold text-flag" : ""}`}>
                    {usd(line.charge)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-hairline">
              <td className="px-4 py-3 text-ink-muted" colSpan={2}>
                Amount due on the bill
              </td>
              <td className="money px-4 py-3 text-right font-semibold">{usd(bill.amountDue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
