import type { ReactNode } from "react";
import { usd } from "@/lib/engine/money";
import type { AnalysisResult } from "@/lib/types";

/**
 * A stack of letters under frosted glass, with the offer on top. The text
 * under the glass is built only from what the free results already show
 * (provider, totals, finding titles): the real letters are written on the
 * server after payment and never sent before.
 */
export function LockedPreview({
  result,
  children,
}: {
  result: AnalysisResult;
  children: ReactNode;
}) {
  const letter = [
    result.bill.provider,
    "Patient Billing Department",
    "",
    `Re: Dispute of statement dated ${result.bill.statementDate || "[date]"}`,
    "",
    "To whom it may concern,",
    "",
    `I am writing to dispute charges on the statement above, which asks me to pay ${usd(result.amountBilled)}. ` +
      `I found the following errors totaling ${usd(result.potentialSavings)}:`,
    "",
    ...result.findings.map((f, i) => `${i + 1}. ${f.title} (${usd(f.amount)})`),
  ].join("\n");

  const script = [
    `"Hi, I'm calling about my account with ${result.bill.provider}.`,
    "I'd like to dispute several charges on my itemized statement...",
  ].join("\n");

  return (
    // From sm up the offer sits in the flow at the bottom right, so a taller
    // offer grows the box instead of being clipped; the stack stays behind it.
    <div className="relative overflow-hidden rounded-[10px] bg-desk px-3 pb-4 pt-6 sm:flex sm:min-h-[424px] sm:flex-col sm:justify-end sm:p-8">
      <div
        aria-hidden="true"
        className="relative h-[260px] w-full max-w-[520px] select-none sm:absolute sm:left-8 sm:top-8 sm:h-[360px] sm:w-[calc(62%-40px)]"
      >
        <Sheet text={script} className="left-6 top-6 rotate-[3deg]" />
        <Sheet text={letter} className="left-3 top-3 -rotate-[2deg]" />
        <Sheet text={letter} className="left-0 top-0" />
      </div>
      <div className="relative -mt-24 sm:mt-0 sm:ml-auto sm:w-[420px]">
        <div className="rounded-[14px] border border-white/70 bg-white/60 p-6 text-ink backdrop-blur-md">
          {children}
        </div>
      </div>
    </div>
  );
}

function Sheet({ text, className }: { text: string; className: string }) {
  return (
    <div className={`paper-shadow absolute right-0 h-full ${className}`}>
      <pre className="paper h-full overflow-hidden whitespace-pre-wrap px-6 py-6 font-sans text-[11px] leading-relaxed blur-[2.5px]">
        {text}
      </pre>
    </div>
  );
}
