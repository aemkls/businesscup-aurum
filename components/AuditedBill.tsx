import type { CSSProperties, ReactNode } from "react";
import { markUpBill, type LineMark } from "@/lib/annotations";
import { usd } from "@/lib/engine/money";
import type { Bill, Finding } from "@/lib/types";
import { Paper } from "./ui";

/**
 * The bill as a sheet of paper, marked up the way a careful reader would:
 * yellow marker on the problem lines, red pen striking out and correcting,
 * short notes in the margin, and the corrected total written by hand.
 *
 * The marks come from the engine's findings (lib/annotations.ts). They are
 * drawn once, top to bottom, in about three seconds; with reduced motion
 * the finished page shows at once (see globals.css).
 */
export function AuditedBill({
  bill,
  findings,
  fairAmount,
  start = 300,
  label,
}: {
  bill: Bill;
  findings: Finding[];
  fairAmount: number;
  /** Delay before the first mark, in ms. */
  start?: number;
  /** Accessible description of the figure. */
  label: string;
}) {
  const markup = markUpBill(bill, findings, fairAmount);
  const steps = markup.lines.filter(Boolean).length + markup.loose.length + 1;
  const step = Math.min(450, Math.round(2600 / steps));
  let order = 0;
  const next = () => start + step * order++;

  return (
    <figure aria-label={label} className="m-0">
      <Paper torn>
        <div className="px-4 pb-6 pt-6 font-mono text-[12px] leading-[1.55] text-bill-text sm:px-7 sm:text-[13px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold">{bill.provider}</p>
              <p className="text-ink-muted">Itemized patient statement</p>
            </div>
            {bill.statementDate && (
              <p className="shrink-0 text-right text-ink-muted">{bill.statementDate}</p>
            )}
          </div>

          <div className={`${GRID} mt-5 border-b border-dashed border-rule pb-1 text-ink-muted`}>
            <span />
            <span className="hidden sm:block">Code</span>
            <span>Service</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Amount</span>
          </div>

          <ol className="mt-1">
            {bill.lines.map((line, row) => {
              const mark = markup.lines[row];
              const at = mark ? next() : 0;
              return (
                <li key={row} className="py-[3px]">
                  <div className={`${GRID} relative isolate`}>
                    {mark && (
                      <span
                        aria-hidden="true"
                        className="mark-marker absolute inset-y-0 left-6 right-0 -z-10 -skew-x-6 rounded-[2px] bg-marker sm:left-7"
                        style={delay(at)}
                      />
                    )}
                    <span className="relative">
                      {mark && <FindingNumber n={mark.finding + 1} at={at + 120} />}
                    </span>
                    <span className="hidden truncate sm:block">{line.code || "—"}</span>
                    <span className="min-w-0">
                      <span
                        className={mark?.strikeLine ? "pen-strike" : undefined}
                        style={mark?.strikeLine ? delay(at + 220) : undefined}
                      >
                        {line.description}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="relative inline-block">
                        {line.quantity}
                        {mark?.quantity && (
                          <>
                            <Strike at={at + 220} />
                            <span
                              aria-hidden="true"
                              className="mark-write absolute -right-2 -top-4 font-hand text-[22px] font-medium leading-none text-pen"
                              style={delay(at + 380)}
                            >
                              {mark.quantity.to}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="money text-right">
                      <span className="relative inline-block">
                        {usd(line.charge)}
                        {(mark?.strikeLine || mark?.correctedCharge != null) && (
                          <Strike at={at + 260} />
                        )}
                      </span>
                    </span>
                  </div>
                  {mark && <MarginNote mark={mark} at={at + 420} />}
                </li>
              );
            })}
          </ol>

          {markup.loose.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-dashed border-rule pt-3">
              {markup.loose.map((note) => {
                const at = next();
                return (
                  <li key={note.finding} className={`${GRID} items-center`}>
                    <span className="relative">
                      <FindingNumber n={note.finding + 1} at={at} />
                    </span>
                    <Hand at={at + 150} className="col-span-3 -rotate-1 sm:col-span-4">
                      {note.note}: {usd(note.amount)}
                    </Hand>
                  </li>
                );
              })}
            </ul>
          )}

          <dl className="mt-3 space-y-0.5 border-t border-dashed border-rule pt-3">
            <TotalRow label="Total charges" value={usd(bill.totalCharges)} />
            {bill.insurancePaid > 0 && (
              <TotalRow label="Insurance payments" value={`-${usd(bill.insurancePaid)}`} />
            )}
            {bill.adjustments > 0 && (
              <TotalRow label="Adjustments" value={`-${usd(bill.adjustments)}`} />
            )}
            <Total bill={bill} corrected={markup.correctedTotal} at={next()} />
          </dl>
        </div>
      </Paper>
    </figure>
  );
}

/** Margin, code (from sm up), service, qty, amount. */
const GRID =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_1.75rem_5.5rem] items-baseline gap-x-2 sm:grid-cols-[1.75rem_3.75rem_minmax(0,1fr)_2.25rem_6rem] sm:gap-x-3";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

function Hand({
  at,
  className = "",
  children,
}: {
  at: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`mark-write inline-block font-hand text-[21px] font-medium leading-tight text-pen sm:text-note ${className}`}
      style={delay(at)}
    >
      {children}
    </span>
  );
}

function MarginNote({ mark, at }: { mark: LineMark; at: number }) {
  return (
    <div className={`${GRID} -mt-0.5`}>
      <span />
      <span className="hidden sm:block" />
      <Hand at={at} className="col-span-2 -rotate-1">
        {mark.note}
      </Hand>
      <span className="text-right">
        {mark.correctedCharge != null && <Hand at={at + 120}>{usd(mark.correctedCharge)}</Hand>}
      </span>
    </div>
  );
}

/** A hand-drawn circle around the finding number, in the left margin. */
function FindingNumber({ n, at }: { n: number; at: number }) {
  return (
    <span className="relative inline-flex size-6 items-center justify-center">
      <span className="sr-only">Finding {n}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        className="absolute inset-[-3px] size-[30px] overflow-visible"
      >
        <path
          d="M29 9 C 19 2, 5 9, 5 21 C 5 33, 25 38, 33 28 C 39 19, 31 7, 21 7"
          pathLength={1}
          fill="none"
          stroke="var(--color-pen)"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="mark-stroke"
          style={delay(at)}
        />
      </svg>
      <span
        aria-hidden="true"
        className="mark-write relative font-hand text-[19px] font-medium leading-none text-pen"
        style={delay(at + 150)}
      >
        {n}
      </span>
    </span>
  );
}

/** A slightly wavy red-pen line through the text. */
function Strike({ at }: { at: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -left-1 top-1/2 h-2 w-[calc(100%+0.5rem)] -translate-y-1/2 overflow-visible"
    >
      <path
        d="M0 5 Q 12 2.5 25 4.5 T 50 4 T 75 4.5 T 100 3"
        pathLength={1}
        fill="none"
        stroke="var(--color-pen)"
        strokeWidth="2"
        strokeLinecap="round"
        className="mark-stroke"
        style={delay(at)}
      />
    </svg>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="money">{value}</dd>
    </div>
  );
}

function Total({ bill, corrected, at }: { bill: Bill; corrected: number | null; at: number }) {
  return (
    <div className="flex items-start justify-between gap-4 pt-1">
      <dt className="font-semibold">Amount due</dt>
      <dd className="text-right">
        <span className="money relative font-semibold">
          {usd(bill.amountDue)}
          {corrected != null && <Strike at={at} />}
        </span>
        {corrected != null && (
          <span className="relative mt-1 block">
            <span
              className="mark-write inline-block -rotate-2 font-hand text-[30px] font-medium leading-none text-pen sm:text-[34px]"
              style={delay(at + 250)}
            >
              {usd(corrected)}
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              className="absolute -bottom-2 right-0 h-2.5 w-full overflow-visible"
            >
              <path
                d="M2 4 Q 50 1 98 4"
                pathLength={1}
                fill="none"
                stroke="var(--color-pen)"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="mark-stroke"
                style={delay(at + 650)}
              />
              <path
                d="M8 10 Q 52 7 94 9"
                pathLength={1}
                fill="none"
                stroke="var(--color-pen)"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="mark-stroke"
                style={delay(at + 750)}
              />
            </svg>
          </span>
        )}
      </dd>
    </div>
  );
}
