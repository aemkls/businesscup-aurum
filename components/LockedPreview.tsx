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
    <div className="relative overflow-hidden rounded-[10px] bg-desk px-3 pb-6 pt-8 sm:px-10 sm:pt-10">
      <div
        aria-hidden="true"
        className="relative mx-auto h-[400px] max-w-[520px] select-none sm:h-[380px]"
      >
        <Sheet text={script} className="left-6 top-6 rotate-[3deg]" />
        <Sheet text={letter} className="left-3 top-3 -rotate-[2deg]" />
        <Sheet text={letter} className="left-0 top-0" />
      </div>
      <div className="absolute inset-x-3 bottom-4 flex justify-center sm:inset-x-10 sm:bottom-6">
        <div className="w-full max-w-[460px] rounded-[14px] border border-white/70 bg-white/55 p-6 text-ink backdrop-blur-md">
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
