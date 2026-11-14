import { usd } from "@/lib/engine/money";
import type { AnalysisResult } from "@/lib/types";

/**
 * A blurred teaser of the paid documents. It is built only from what the
 * free results already show (provider, totals, finding titles): the real
 * letters are generated on the server after payment and never sent before.
 */
export function LockedPreview({ result }: { result: AnalysisResult }) {
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
    "",
    "Write down: the representative's name, the date, the reference number.",
  ].join("\n");

  return (
    <div className="relative grid gap-4 sm:grid-cols-2" aria-hidden="true">
      <Teaser title="Dispute letter" text={letter} />
      <Teaser title="Call script" text={script} />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-tile-dark px-4 py-2 text-caption font-semibold text-on-dark">
          Unlock to read, fill in and send
        </span>
      </div>
    </div>
  );
}

function Teaser({ title, text }: { title: string; text: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] bg-parchment">
      <p className="px-5 pt-4 text-fine font-semibold text-ink-muted">{title}</p>
      <pre className="pointer-events-none h-40 select-none whitespace-pre-wrap px-5 py-3 font-sans text-fine blur-[3px]">
        {text}
      </pre>
    </div>
  );
}
