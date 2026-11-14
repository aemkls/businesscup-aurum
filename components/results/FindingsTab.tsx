"use client";

import { useState } from "react";
import { usd } from "@/lib/engine/money";
import type { AnalysisResult, Finding } from "@/lib/types";
import { Chip, TextButton } from "../ui";
import { CONFIDENCE, findingNumber } from "./findingLabels";

/** Compact list of findings; evidence stays collapsed until asked for. */
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
      <div className="rounded-[18px] bg-parchment p-6 sm:p-8">
        <h2 className="text-tagline font-semibold">Nothing to dispute</h2>
        <p className="mt-2 text-body text-ink-muted">
          {result.meta.hasEob
            ? "Every line matches your EOB and your plan terms. There is nothing to dispute."
            : "We found no duplicates or quantity errors. Add your EOB to check rates, deductible math and denials too."}
        </p>
        <TextButton onClick={onPayLess} className="mt-4 text-body">
          You may still pay less: check for financial assistance ›
        </TextButton>
      </div>
    );
  }

  return (
    <ol className="divide-y divide-hairline">
      {result.findings.map((finding, i) => (
        <FindingRow
          key={finding.id}
          finding={finding}
          index={i}
          onShowOnBill={() => onShowOnBill(finding.id)}
        />
      ))}
    </ol>
  );
}

function FindingRow({
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
    <li className="py-6 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-body font-semibold">
          <span className="money mr-2 text-ink-muted">{findingNumber(index)}</span>
          {finding.title}
        </h3>
        <span className="money shrink-0 text-tagline font-semibold">{usd(finding.amount)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Chip tone={confidence.tone}>{confidence.label}</Chip>
        <span className="text-caption text-ink-muted">
          Raise with your {finding.target === "provider" ? "hospital" : "insurer"}
        </span>
      </div>
      <p className="mt-3 text-caption text-ink-muted">{finding.explanation}</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <TextButton onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={evidenceId}>
          {open ? "Hide evidence" : "Show evidence"}
        </TextButton>
        {finding.codes.length > 0 && (
          <TextButton onClick={onShowOnBill}>See it on your bill ›</TextButton>
        )}
      </div>
      {open && (
        <ul id={evidenceId} className="mt-3 space-y-1 rounded-[8px] bg-parchment px-4 py-3">
          {finding.evidence.map((line) => (
            <li key={line} className="money text-fine text-ink">
              {line}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
