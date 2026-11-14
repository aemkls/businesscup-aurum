"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { saveCase, useCase, type StoredCase } from "@/lib/caseStore";
import { usd } from "@/lib/engine/money";
import type { CaseLetters, Confidence, Finding } from "@/lib/types";
import { LockedPreview } from "./LockedPreview";

const CONFIDENCE: Record<Confidence, { label: string; className: string }> = {
  high: { label: "High confidence", className: "bg-accent-soft text-accent-dark" },
  medium: { label: "Medium confidence", className: "bg-warn-soft text-warn" },
  low: { label: "Low confidence", className: "bg-line text-muted" },
};

async function fetchLetters(saved: StoredCase, sessionId: string | null): Promise<CaseLetters> {
  const response = await fetch("/api/letters", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, result: saved.result }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not prepare your documents.");
  return data.letters as CaseLetters;
}

export function ResultsView({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const saved = useCase();
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const requested = useRef(false);

  const returning = Boolean(sessionId) && Boolean(saved) && !saved?.letters && !error;

  // Back from Stripe: verify the payment server-side and fetch the documents.
  useEffect(() => {
    if (!sessionId || !saved || saved.letters || requested.current) return;
    requested.current = true;
    fetchLetters(saved, sessionId)
      .then((letters) => {
        saveCase({ ...saved, letters });
        router.replace("/results");
      })
      .catch((e: Error) => setError(e.message));
  }, [sessionId, saved, router]);

  async function unlock() {
    if (!saved) return;
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url as string;
        return;
      }
      if (!data.demo) throw new Error(data.error ?? "Could not start the checkout.");
      // Payments are not configured on this deployment: unlock without a charge.
      saveCase({ ...saved, letters: await fetchLetters(saved, null) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setStarting(false);
  }

  if (saved === undefined) return <p className="text-muted">Loading your case…</p>;
  if (saved === null) {
    return (
      <div className="max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">No case in this browser yet</h1>
        <p className="mt-3 text-muted">
          Your case is saved on your device, not on our servers. Start a check to see it here.
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

  const { result, letters } = saved;
  const clean = result.findings.length === 0;

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted">
        {result.bill.provider}
        {result.bill.statementDate && `, statement of ${result.bill.statementDate}`}
      </p>

      {clean ? (
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          We did not find anything to dispute on this bill.
        </h1>
      ) : (
        <>
          <h1 className="mt-2 leading-tight tracking-tight">
            <span className="money block text-5xl font-semibold text-accent sm:text-6xl">
              {usd(result.potentialSavings)}
            </span>
            <span className="mt-1 block text-2xl font-semibold sm:text-3xl">
              likely overcharged
            </span>
          </h1>
          <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm">
            <Figure label="You were billed" value={usd(result.amountBilled)} />
            <Figure label="In dispute" value={usd(result.potentialSavings)} accent />
            <Figure label="If all is corrected" value={usd(result.fairAmount)} />
          </dl>
        </>
      )}

      {!result.meta.hasEob && (
        <Note>
          No EOB was provided, so we could only check the bill against itself. Add the Explanation
          of Benefits from your insurer to check rates, deductible math and denials.{" "}
          <Link href="/check" className="underline">
            Run again with the EOB
          </Link>
          .
        </Note>
      )}
      {!result.meta.aiExtraction && (
        <Note>
          The AI reader was unavailable, so the sample documents were loaded from their structured
          source. Every finding and amount below was still computed by the rule engine.
        </Note>
      )}

      <ol className="mt-8 space-y-4">
        {result.findings.map((finding, i) => (
          <FindingCard key={finding.id} finding={finding} index={i + 1} />
        ))}
      </ol>

      {!clean && !letters && (
        <section className="no-print mt-10 rounded-lg border border-accent bg-card p-6">
          <h2 className="text-xl font-semibold">Get this corrected</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Knowing the bill is wrong is half of it. For one payment you get everything needed to
            fix it:
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>A dispute letter to the billing department, citing each error with its evidence</li>
            {result.findings.some((f) => f.target === "insurer") && (
              <li>An internal appeal letter to your insurer</li>
            )}
            <li>A call script, with what to say and what to write down</li>
          </ul>
          <LockedPreview result={result} />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={unlock}
              disabled={starting || returning}
              className="rounded-lg bg-accent px-6 py-3 font-medium text-white hover:bg-accent-dark disabled:opacity-60"
            >
              {returning
                ? "Confirming your payment…"
                : starting
                  ? "One moment…"
                  : "Unlock my case for $19"}
            </button>
            <span className="text-sm text-muted">One-time payment. No subscription.</span>
          </div>
          <p className="mt-4 rounded bg-paper px-3 py-2 text-xs text-muted">
            Test mode, no real charge. Use card{" "}
            <span className="money">4242 4242 4242 4242</span>, any future date, any CVC.
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded bg-warn-soft px-3 py-2 text-sm text-warn">
              {error}
            </p>
          )}
        </section>
      )}

      {letters && (
        <>
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Your documents</h2>
            <p className="mt-1 text-sm text-muted">
              Fill in the bracketed fields before sending.
            </p>
            <div className="mt-4 space-y-4">
              <LetterBlock title="Dispute letter to the billing department" text={letters.providerLetter} open />
              <LetterBlock title="Appeal letter to your insurer" text={letters.insurerAppeal} />
              <LetterBlock title="Call script" text={letters.callScript} />
            </div>
          </section>
        </>
      )}

      {!clean && (
        <Link
          href="/case"
          className="no-print mt-10 flex items-center justify-between gap-4 rounded-lg border border-line bg-card px-5 py-4 text-sm hover:border-accent"
        >
          <span>
            <span className="font-medium">My case:</span> your step-by-step follow-up plan, with
            calendar reminders.
          </span>
          <span className="font-medium text-accent">Open</span>
        </Link>
      )}

      <div className="no-print mt-12 flex flex-wrap gap-4 text-sm">
        <button onClick={() => window.print()} className="underline">
          Print this page
        </button>
        <button
          onClick={() => {
            saveCase(null);
            router.push("/check");
          }}
          className="text-muted underline"
        >
          Delete this case and start a new check
        </button>
      </div>
    </div>
  );
}

function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`money mt-1 text-lg font-semibold ${accent ? "text-accent" : ""}`}>{value}</dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-lg bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
      {children}
    </p>
  );
}

function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const confidence = CONFIDENCE[finding.confidence];
  return (
    <li className="rounded-lg border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold leading-snug">
          <span className="money mr-2 text-sm text-muted">{String(index).padStart(2, "0")}</span>
          {finding.title}
        </h3>
        <span className="money shrink-0 text-lg font-semibold">{usd(finding.amount)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 ${confidence.className}`}>{confidence.label}</span>
        <span className="rounded bg-paper px-2 py-0.5 text-muted">
          Raise with your {finding.target === "provider" ? "hospital" : "insurer"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{finding.explanation}</p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">Evidence from your documents</summary>
        <ul className="mt-2 space-y-1 font-mono text-xs text-muted">
          {finding.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function LetterBlock({ title, text, open }: { title: string; text: string; open?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <details open={open} className="rounded-lg border border-line bg-card">
      <summary className="cursor-pointer px-5 py-3 font-medium">{title}</summary>
      <div className="border-t border-line px-5 py-4">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{text}</pre>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="no-print mt-4 rounded border border-ink/25 px-3 py-1.5 text-sm hover:border-ink"
        >
          {copied ? "Copied" : "Copy text"}
        </button>
      </div>
    </details>
  );
}
