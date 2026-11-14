"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveCase, useCase, type StoredCase } from "@/lib/caseStore";
import { usd } from "@/lib/engine/money";
import type { CaseLetters } from "@/lib/types";
import { AssistanceCheck } from "./AssistanceCheck";
import { BillXray } from "./BillXray";
import { FindingsTab } from "./results/FindingsTab";
import { LettersTab } from "./results/LettersTab";
import { TabPanel, Tabs, type TabItem } from "./results/Tabs";
import { Band, Button, ButtonLink, ErrorNote, TextButton } from "./ui";

type TabId = "found" | "bill" | "letters" | "pay-less";

const TABS: TabItem<TabId>[] = [
  { id: "found", label: "What we found" },
  { id: "bill", label: "Your bill" },
  { id: "letters", label: "Letters" },
  { id: "pay-less", label: "Pay less" },
];

const isTab = (value: string | null): value is TabId => TABS.some((t) => t.id === value);

async function fetchLetters(saved: StoredCase, sessionId: string | null): Promise<CaseLetters> {
  const response = await fetch("/api/letters", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, result: saved.result, household: saved.household ?? null }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Could not prepare your documents.");
  return data.letters as CaseLetters;
}

export function ResultsView({
  sessionId,
  tab,
  finding,
}: {
  sessionId: string | null;
  tab: string | null;
  finding: string | null;
}) {
  const router = useRouter();
  const saved = useCase();
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const requested = useRef(false);
  const active: TabId = isTab(tab) ? tab : "found";

  const returning = Boolean(sessionId) && Boolean(saved) && !saved?.letters && !error;

  // Back from Stripe: verify the payment server-side and fetch the documents.
  useEffect(() => {
    if (!sessionId || !saved || saved.letters || requested.current) return;
    requested.current = true;
    fetchLetters(saved, sessionId)
      .then((letters) => {
        saveCase({ ...saved, letters });
        router.replace("/results?tab=letters");
      })
      .catch((e: Error) => setError(e.message));
  }, [sessionId, saved, router]);

  /** Tabs live in the URL so Back and shared links work. */
  function go(next: TabId, findingId?: string | null) {
    const query = new URLSearchParams({ tab: next });
    if (findingId) query.set("finding", findingId);
    router.push(`/results?${query}`, { scroll: false });
  }

  async function unlock() {
    if (!saved) return;
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url as string;
        return;
      }
      if (!data.demo) throw new Error(data.error ?? "Could not start the checkout.");
      // Payments are not configured on this deployment: unlock without a charge.
      saveCase({ ...saved, letters: await fetchLetters(saved, null) });
      go("letters");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setStarting(false);
  }

  if (saved === undefined) {
    return (
      <Band tone="dark">
        <p className="text-on-dark-muted">Loading your case…</p>
      </Band>
    );
  }
  if (saved === null) {
    return (
      <Band>
        <div className="max-w-[640px]">
          <h1 className="text-section-sm font-semibold md:text-section">No case in this browser yet</h1>
          <p className="mt-4 text-body text-ink-muted">
            Your case is saved on your device, not on our servers. Check a bill, or try the sample to
            see how it works.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/check?sample=1">Try with a sample bill</ButtonLink>
            <ButtonLink href="/check" variant="secondary">
              Check my bill
            </ButtonLink>
          </div>
        </div>
      </Band>
    );
  }

  const { result, letters } = saved;
  const clean = result.findings.length === 0;

  const unlockButton = (
    <Button onClick={unlock} disabled={starting || returning}>
      {returning ? "Confirming your payment…" : starting ? "One moment…" : "Unlock my case for $19"}
    </Button>
  );

  return (
    <>
      <section className="bg-tile-dark px-4 py-12 text-on-dark sm:px-6 md:py-20">
        <div className="rise mx-auto max-w-[980px]">
          <p className="text-caption text-on-dark-muted">
            {result.bill.provider}
            {result.bill.statementDate && ` · statement of ${result.bill.statementDate}`}
          </p>
          {clean ? (
            <>
              <h1 className="mt-3 text-hero-sm font-semibold md:text-hero">Your bill looks right</h1>
              <p className="mt-4 max-w-[640px] text-tagline font-normal text-on-dark-muted">
                {result.meta.hasEob
                  ? "Nothing on it contradicts your EOB or your plan. You may still be able to pay less."
                  : "No duplicates or quantity errors. Add your EOB for a full check."}
              </p>
            </>
          ) : (
            <h1 className="mt-3">
              <span className="money block text-hero-number-sm font-semibold md:text-hero-number">
                {usd(result.potentialSavings)}
              </span>
              <span className="mt-2 block text-tagline font-semibold">likely overcharged</span>
            </h1>
          )}

          <dl className="mt-8 grid grid-cols-3 gap-4 sm:max-w-[640px]">
            <Figure label="You were billed" value={usd(result.amountBilled)} />
            <Figure label="In dispute" value={usd(result.potentialSavings)} />
            <Figure label="If corrected" value={usd(result.fairAmount)} />
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {clean ? (
              <Button onClick={() => go("pay-less")}>See if you can pay less</Button>
            ) : letters ? (
              <Button onClick={() => go("letters")}>Send your letters</Button>
            ) : (
              <>
                {unlockButton}
                <span className="text-caption text-on-dark-muted">
                  Letters, appeal and call script. $19 once.
                </span>
              </>
            )}
          </div>
          {error && active !== "letters" && (
            <div className="mt-6 max-w-[640px]">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </div>
      </section>

      <Band wide={active === "bill"} className="!pt-8 md:!pt-12">
        <Tabs tabs={TABS} active={active} onChange={(id) => go(id)} label="Your results" />

        <TabPanel id={active}>
          {active === "found" && (
            <>
              <Notes saved={saved} />
              <FindingsTab
                result={result}
                onShowOnBill={(id) => go("bill", id)}
                onPayLess={() => go("pay-less")}
              />
            </>
          )}
          {active === "bill" && (
            <BillXray
              bill={result.bill}
              findings={result.findings}
              selected={finding}
              onSelect={(id) => {
                const query = new URLSearchParams({ tab: "bill" });
                if (id) query.set("finding", id);
                router.replace(`/results?${query}`, { scroll: false });
              }}
            />
          )}
          {active === "letters" && (
            <LettersTab
              saved={saved}
              unlockButton={unlockButton}
              error={error}
              onPayLess={() => go("pay-less")}
            />
          )}
          {active === "pay-less" && <AssistanceCheck saved={saved} />}
        </TabPanel>

        <div className="no-print mt-16 flex flex-col gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
          {!clean && (
            <Link href="/case" className="text-body text-primary hover:underline">
              My case: your follow-up plan and reminders ›
            </Link>
          )}
          <TextButton
            onClick={() => {
              if (!window.confirm("Delete this case from this browser?")) return;
              saveCase(null);
              router.push("/check");
            }}
          >
            Delete this case and start over
          </TextButton>
        </div>
      </Band>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-fine text-on-dark-muted">{label}</dt>
      <dd className="money mt-1 text-body font-semibold sm:text-tagline">{value}</dd>
    </div>
  );
}

/** Quiet notes about what the check could and could not do. */
function Notes({ saved }: { saved: StoredCase }) {
  const { meta } = saved.result;
  if (meta.hasEob && meta.aiExtraction) return null;
  return (
    <div className="mb-8 space-y-2 rounded-[18px] bg-parchment px-6 py-4 text-caption text-ink-muted">
      {!meta.hasEob && (
        <p>
          <span className="font-semibold text-ink">No EOB was added,</span> so we only checked the
          bill against itself. The EOB unlocks rate, deductible and denial checks.{" "}
          <Link href="/check" className="text-primary hover:underline">
            Run again with the EOB
          </Link>
        </p>
      )}
      {!meta.aiExtraction && (
        <p>
          <span className="font-semibold text-ink">The AI reader was busy,</span> so the sample
          documents were loaded from their structured source. Every amount was still computed by the
          rule engine.
        </p>
      )}
    </div>
  );
}
