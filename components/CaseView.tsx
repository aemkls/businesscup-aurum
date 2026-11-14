"use client";

import Link from "next/link";
import { useCase } from "@/lib/caseStore";
import { usd } from "@/lib/engine/money";
import { CaseTracker } from "./CaseTracker";

/** "My case": the dispute tracker, read from this browser's localStorage. */
export function CaseView() {
  const saved = useCase();

  if (saved === undefined) return <p className="text-muted">Loading your case…</p>;
  if (saved === null) {
    return (
      <div className="max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">No case in this browser yet</h1>
        <p className="mt-3 text-muted">
          Your case is saved on your device, not on our servers. Check a bill to start one.
        </p>
        <Link
          href="/check"
          className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 font-medium text-white hover:bg-accent-dark"
        >
          Check my bill
        </Link>
      </div>
    );
  }

  const { result } = saved;
  const started = new Date(saved.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted">Started {started}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">My case</h1>
      <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm">
        <Figure label="Provider" value={result.bill.provider} />
        <Figure label="Billed" value={usd(result.amountBilled)} money />
        <Figure label="In dispute" value={usd(result.potentialSavings)} money accent />
      </dl>

      <CaseTracker saved={saved} />

      <div className="no-print mt-10 flex flex-wrap gap-4 text-sm">
        <Link href="/results" className="underline">
          {saved.letters ? "Back to findings and letters" : "Back to findings"}
        </Link>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  money,
  accent,
}: {
  label: string;
  value: string;
  money?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-1 font-semibold ${money ? "money text-lg" : "truncate"} ${accent ? "text-accent" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
