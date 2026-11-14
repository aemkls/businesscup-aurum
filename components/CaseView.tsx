"use client";

import Link from "next/link";
import { useCase } from "@/lib/caseStore";
import { usd } from "@/lib/engine/money";
import { CaseTracker } from "./CaseTracker";
import { ButtonLink, Section } from "./ui";

/** "My case": the dispute tracker, read from this browser's localStorage. */
export function CaseView() {
  const saved = useCase();

  if (saved === undefined) {
    return (
      <Section>
        <p className="text-ink-muted">Loading your case…</p>
      </Section>
    );
  }
  if (saved === null) {
    return (
      <Section>
        <div className="max-w-[640px]">
          <h1 className="text-section-sm font-extrabold md:text-section">
            No case in this browser yet
          </h1>
          <p className="mt-4 text-body text-ink-muted">
            We save your case on this device, not on our servers. Check a bill to start one.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/check">Check my bill</ButtonLink>
            <ButtonLink href="/check?sample=er" variant="secondary">
              Try with a sample bill
            </ButtonLink>
          </div>
        </div>
      </Section>
    );
  }

  const { result } = saved;
  const started = new Date(saved.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Section>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-section-sm font-extrabold md:text-section">My case</h1>
        <p className="mt-2 text-body text-ink-muted">
          Started {started}. We keep this case file in this browser only.
        </p>

        <div className="paper-shadow -mx-4 mt-8 sm:mx-0">
          <div className="ml-3 inline-block rounded-t-[10px] bg-desk-deep px-5 pb-2 pt-3 font-mono text-fine text-ink sm:ml-0">
            Case file · {result.bill.provider}
          </div>
          <div className="bg-desk-deep p-2 sm:rounded-b-[8px] sm:rounded-tr-[8px] sm:p-3">
            <div className="paper rounded-[4px] px-4 py-6 text-ink sm:px-8 sm:py-8">
              <dl className="grid grid-cols-2 gap-4 border-b border-dashed border-rule pb-6 sm:grid-cols-3">
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <dt className="text-fine text-ink-muted">Provider</dt>
                  <dd className="mt-1 break-words text-body font-semibold">
                    {result.bill.provider}
                  </dd>
                </div>
                <div>
                  <dt className="text-fine text-ink-muted">Billed</dt>
                  <dd className="mt-1 font-mono text-body">{usd(result.amountBilled)}</dd>
                </div>
                <div>
                  <dt className="text-fine text-ink-muted">In dispute</dt>
                  <dd className="mt-1 font-mono text-body font-semibold">
                    {usd(result.potentialSavings)}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                {result.findings.length === 0 ? (
                  <div>
                    <h2 className="text-tagline font-bold">Nothing to dispute</h2>
                    <p className="mt-2 text-body text-ink-muted">
                      Your bill looked right, so there are no letters to follow up on.{" "}
                      <Link
                        href="/results?tab=pay-less"
                        className="font-semibold text-action hover:underline"
                      >
                        Check whether you can pay less
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <CaseTracker saved={saved} />
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-caption">
          <Link href="/results" className="font-semibold text-action hover:underline">
            Back to your results
          </Link>
          {!saved.letters && result.findings.length > 0 && (
            <span className="text-ink-muted">
              {" "}
              · Your letters are in the{" "}
              <Link
                href="/results?tab=letters"
                className="font-semibold text-action hover:underline"
              >
                Letters tab
              </Link>
              .
            </span>
          )}
        </p>
      </div>
    </Section>
  );
}
