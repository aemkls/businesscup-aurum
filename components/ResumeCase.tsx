"use client";

import Link from "next/link";
import { useCase } from "@/lib/caseStore";
import { usd } from "@/lib/engine/money";

/** Shown in the landing hero when this browser already has a case. */
export function ResumeCase() {
  const saved = useCase();
  if (!saved) return null;
  return (
    <p className="mt-8 text-caption text-on-dark-muted">
      You have an open case with {saved.result.bill.provider}
      {saved.result.potentialSavings > 0 && (
        <>
          : <span className="money text-on-dark">{usd(saved.result.potentialSavings)}</span> in
          dispute
        </>
      )}
      .{" "}
      <Link href="/results" className="text-primary-on-dark hover:underline">
        Continue your case ›
      </Link>
    </p>
  );
}
