"use client";

import Link from "next/link";
import { useCase } from "@/lib/caseStore";
import { usd } from "@/lib/engine/money";
import { CaseTracker } from "./CaseTracker";
import { Band, ButtonLink } from "./ui";

/** "My case": the dispute tracker, read from this browser's localStorage. */
export function CaseView() {
  const saved = useCase();

  if (saved === undefined) {
    return (
      <Band>
        <p className="text-ink-muted">Loading your case…</p>
      </Band>
    );
  }
  if (saved === null) {
    return (
      <Band>
        <div className="max-w-[640px]">
          <h1 className="text-section-sm font-semibold md:text-section">No case in this browser yet</h1>
          <p className="mt-4 text-body text-ink-muted">
            Your case is saved on your device, not on our servers. Check a bill to start one.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/check">Check my bill</ButtonLink>
            <ButtonLink href="/check?sample=1" variant="secondary">
              Try with a sample bill
            </ButtonLink>
          </div>
        </div>
      </Band>
    );
  }

  const { result } = saved;
  const started = new Date(saved.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Band>
      <div className="mx-auto max-w-[720px]">
        <p className="text-caption text-ink-muted">Started {started}</p>
        <h1 className="mt-1 text-section-sm font-semibold md:text-section">My case</h1>
        <dl className="mt-6 grid gap-4 rounded-[18px] bg-parchment p-6 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-fine text-ink-muted">Provider</dt>
            <dd className="mt-1 break-words text-body font-semibold">
              {result.bill.provider}
            </dd>
          </div>
          <div>
            <dt className="text-fine text-ink-muted">Billed</dt>
            <dd className="money mt-1 text-body font-semibold">{usd(result.amountBilled)}</dd>
          </div>
          <div>
            <dt className="text-fine text-ink-muted">In dispute</dt>
            <dd className="money mt-1 text-body font-semibold">{usd(result.potentialSavings)}</dd>
          </div>
        </dl>

        <div className="mt-12">
          {result.findings.length === 0 ? (
            <div>
              <h2 className="text-tagline font-semibold">Nothing to dispute</h2>
              <p className="mt-2 text-body text-ink-muted">
                Your bill looked right, so there are no letters to follow up on.{" "}
                <Link href="/results?tab=pay-less" className="text-primary hover:underline">
                  Check whether you can pay less
                </Link>
                .
              </p>
            </div>
          ) : (
            <CaseTracker saved={saved} />
          )}
        </div>

        <p className="mt-12 text-caption">
          <Link href="/results" className="text-primary hover:underline">
            ‹ Back to your results
          </Link>
          {!saved.letters && result.findings.length > 0 && (
            <span className="text-ink-muted">
              {" "}
              · Your letters are in the{" "}
              <Link href="/results?tab=letters" className="text-primary hover:underline">
                Letters tab
              </Link>
              .
            </span>
          )}
        </p>
      </div>
    </Band>
  );
}
