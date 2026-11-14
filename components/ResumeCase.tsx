"use client";

import Link from "next/link";
import { useCase } from "@/lib/caseStore";
import { usd } from "@/lib/engine/money";

/** Shown under the hero buttons when this browser already has a case. */
export function ResumeCase() {
  const saved = useCase();
  if (!saved) return null;
  return (
    <p className="mt-6 max-w-[520px] border-l-2 border-ink pl-4 text-caption text-ink">
      You have an open case with {saved.result.bill.provider}
      {saved.result.potentialSavings > 0 && (
        <>
          : <span className="font-mono font-semibold">{usd(saved.result.potentialSavings)}</span> in
          dispute
        </>
      )}
      .{" "}
      <Link href="/results" className="font-semibold text-action hover:underline">
        Continue your case
      </Link>
    </p>
  );
}
