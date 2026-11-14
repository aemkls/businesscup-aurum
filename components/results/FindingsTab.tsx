"use client";

import { useState } from "react";
import { usd } from "@/lib/engine/money";
import type { AnalysisResult, Finding } from "@/lib/types";
import { Chip, TextButton } from "../ui";
import { CONFIDENCE } from "./findingLabels";

/**
 * Findings as notes in the margin of the case file: the number circled in
 * red pen, what is wrong, and the amount on the right.
 */
export function FindingsTab({
  result,
  onShowOnBill,
  onPayLess,
}: {
  result: AnalysisResult;
  onShowOnBill: (findingId: string) => void;
  onPayLess: () => void;
}) {
  if (result.findings.length === 0) {
    return (
      <div>
        <h2 className="text-section-sm font-bold">Nothing to dispute</h2>
        <p className="mt-3 max-w-[620px] text-body text-ink-muted">
          {result.meta.hasEob
            ? "Every line matches your EOB and your plan terms."
            : "We found no duplicate lines or wrong quantities. Add your EOB to also check rates, deductible math and denials."}
        </p>
        <TextButton onClick={onPayLess} className="mt-4 text-body">
          You may still pay less: check for financial assistance
        </TextButton>
      </div>
    );
  }

  return (
    <ol>
      {result.findings.map((finding, i) => (
        <FindingNote
          key={finding.id}
          finding={finding}
          index={i}
          onShowOnBill={() => onShowOnBill(finding.id)}
        />
      ))}
    </ol>
  );
}

function FindingNote({
  finding,
  index,
  onShowOnBill,
}: {
  finding: Finding;
  index: number;
  onShowOnBill: () => void;
}) {
  const [open, setOpen] = useState(false);
  const confidence = CONFIDENCE[finding.confidence];
  const evidenceId = `evidence-${finding.id}`;

  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-dashed border-rule py-6 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:gap-x-5">
      <CircledNumber n={index + 1} />
      <div>
        <div className="flex items-start justify-between gap-4 sm:block">
          <h3 className="text-body font-semibold">{finding.title}</h3>
          <Amount finding={finding} className="text-body sm:hidden" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Chip tone={confidence.tone}>{confidence.label}</Chip>
          <span className="text-caption text-ink-muted">
            Raise with your {finding.target === "provider" ? "hospital" : "insurer"}
          </span>
        </div>
        <p className="mt-3 max-w-[640px] text-caption text-ink-muted">{finding.explanation}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <TextButton
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={evidenceId}
          >
            {open ? "Hide evidence" : "Show evidence"}
          </TextButton>
          {finding.codes.length > 0 && (
            <TextButton onClick={onShowOnBill}>See it on your bill</TextButton>
          )}
        </div>
        {open && (
          <ul id={evidenceId} className="mt-3 space-y-1 border-l-2 border-rule pl-4">
            {finding.evidence.map((line) => (
              <li key={line} className="font-mono text-fine text-bill-text">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Amount finding={finding} className="hidden text-tagline sm:block" />
    </li>
  );
}

/** Counted findings show their amount; a "worth asking" one shows it muted and not counted. */
function Amount({ finding, className }: { finding: Finding; className: string }) {
  if (finding.confidence !== "low") {
    return <span className={`font-mono font-semibold ${className}`}>{usd(finding.amount)}</span>;
  }
  return (
    <span className={`text-right font-mono text-ink-muted ${className}`}>
      {usd(finding.amount)}
      <span className="block font-sans text-fine">not counted</span>
    </span>
  );
}

/** The finding number circled in red pen, as on the paper bill. */
export function CircledNumber({ n }: { n: number | string }) {
  return (
    <span className="relative inline-flex size-9 items-center justify-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        className="absolute inset-0 size-9 overflow-visible"
      >
        <path
          d="M29 9 C 19 2, 5 9, 5 21 C 5 33, 25 38, 33 28 C 39 19, 31 7, 21 7"
          fill="none"
          stroke="var(--color-pen)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-[16px] font-bold leading-none text-pen">
        <span className="sr-only">Finding </span>
        {n}
      </span>
    </span>
  );
}
