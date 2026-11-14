"use client";

import Link from "next/link";
import { useCase } from "@/lib/caseStore";
import { usd } from "@/lib/engine/money";

/** Shown on the landing page when this browser already has a case. */
export function ResumeCase() {
  const saved = useCase();
  if (!saved) return null;
  return (
    <Link
      href="/results"
      className="mt-8 flex items-center justify-between gap-4 rounded-lg border border-accent bg-accent-soft px-5 py-4 text-sm hover:bg-accent-soft/70"
    >
      <span>
        <span className="font-medium">You have an open case</span> with{" "}
        {saved.result.bill.provider}:{" "}
        <span className="money">{usd(saved.result.potentialSavings)}</span> in dispute.
      </span>
      <span className="font-medium text-accent">Continue</span>
    </Link>
  );
}
