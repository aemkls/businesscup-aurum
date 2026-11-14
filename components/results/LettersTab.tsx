"use client";

import { useState } from "react";
import type { StoredCase } from "@/lib/caseStore";
import { downloadText } from "@/lib/download";
import { assistanceLetter } from "@/lib/letters/templates";
import { EMPTY_DETAILS, fillLetter, missingPlaceholders } from "@/lib/letters/fill";
import { useDetails } from "@/lib/personalDetails";
import { LockedPreview } from "../LockedPreview";
import { Button, ErrorNote, TextButton } from "../ui";
import { PersonalDetailsForm } from "./PersonalDetailsForm";
import { usePrintLetters, type PrintDoc } from "./PrintLetters";

interface Doc extends PrintDoc {
  file: string;
}

/** Before payment: blurred preview and the offer. After: details form and letters. */
export function LettersTab({
  saved,
  unlockButton,
  error,
  onPayLess,
}: {
  saved: StoredCase;
  unlockButton: React.ReactNode;
  error: string;
  onPayLess: () => void;
}) {
  const { result, letters } = saved;

  if (result.findings.length === 0) {
    return (
      <div>
        <h2 className="text-section-sm font-bold">No dispute letters needed</h2>
        <p className="mt-3 text-body text-ink-muted">
          We found nothing to dispute on this bill, so there is nothing to send.
        </p>
        <TextButton onClick={onPayLess} className="mt-4 text-body">
          Check whether the hospital can reduce the bill
        </TextButton>
      </div>
    );
  }

  if (!letters) {
    const toInsurer = result.findings.some((f) => f.target === "insurer");
    return (
      <div className="space-y-4">
        <LockedPreview result={result}>
          <h2 className="text-tagline font-bold">Get the letters that fix this</h2>
          <ul className="mt-3 space-y-1.5 text-caption">
            <li>A dispute letter to the billing office, citing each error with its evidence</li>
            {toInsurer && <li>An appeal letter to your insurer</li>}
            <li>A call script: what to say and what to write down</li>
            <li>Your name, address and account numbers filled in</li>
          </ul>
          <div className="mt-5">{unlockButton}</div>
          <p className="mt-3 text-fine text-ink-muted">
            $19 once, no subscription. Stripe test mode: card{" "}
            <span className="font-mono">4242 4242 4242 4242</span>, any future date, any CVC.
          </p>
        </LockedPreview>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    );
  }

  return <UnlockedLetters saved={saved} />;
}

function UnlockedLetters({ saved }: { saved: StoredCase }) {
  const details = useDetails();
  const [editing, setEditing] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const { node: printNode, print } = usePrintLetters();
  const letters = saved.letters!;

  if (details === undefined) return null;
  if (editing || (details === null && !skipped)) {
    return (
      <PersonalDetailsForm
        initial={details}
        onDone={() => setEditing(false)}
        onSkip={details === null ? () => setSkipped(true) : () => setEditing(false)}
      />
    );
  }

  const today = new Date();
  const fill = (text: string) => fillLetter(text, details ?? EMPTY_DETAILS, today);
  const docs: Doc[] = [
    {
      title: "Dispute letter to the billing department",
      file: "dispute-letter.txt",
      text: letters.providerLetter,
    },
    {
      title: "Appeal letter to your insurer",
      file: "insurer-appeal.txt",
      text: letters.insurerAppeal,
    },
    { title: "Call script", file: "call-script.txt", text: letters.callScript },
    {
      title: "Financial assistance request",
      file: "assistance-request.txt",
      // Answered after unlocking: build the request from the paid case locally.
      text: letters.assistanceLetter || assistanceLetter(saved.result, saved.household ?? null),
    },
  ]
    .filter((doc) => doc.text)
    .map((doc) => ({ ...doc, text: fill(doc.text) }));

  async function downloadAll() {
    for (const doc of docs) {
      downloadText(`claimback-${doc.file}`, doc.text);
      // Browsers drop downloads that start in the same tick.
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-dashed border-rule pb-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption">
          {details?.fullName ? (
            <>
              Filled in for <span className="font-semibold">{details.fullName}</span>.{" "}
            </>
          ) : (
            "Your details are not filled in yet. "
          )}
          <TextButton onClick={() => setEditing(true)}>
            {details ? "Edit details" : "Add your details"}
          </TextButton>
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => print(docs)} className="px-5 py-2 !text-caption">
            Save all as PDF
          </Button>
          <Button variant="secondary" onClick={downloadAll} className="px-5 py-2 !text-caption">
            Download all (.txt)
          </Button>
        </div>
      </div>

      {docs.map((doc) => (
        <LetterCard key={doc.title} doc={doc} onPrint={() => print([doc])} />
      ))}
      {printNode}
    </div>
  );
}

function LetterCard({ doc, onPrint }: { doc: Doc; onPrint: () => void }) {
  const [copied, setCopied] = useState(false);
  const missing = missingPlaceholders(doc.text);

  async function copy() {
    try {
      await navigator.clipboard.writeText(doc.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is selectable on the page.
    }
  }

  return (
    <article className="paper-shadow">
      <div className="paper rounded-[4px] border border-rule">
        <header className="flex flex-col gap-3 border-b border-dashed border-rule px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <h3 className="text-body font-semibold">{doc.title}</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <TextButton onClick={copy} aria-live="polite">
              {copied ? "Copied" : "Copy"}
            </TextButton>
            <TextButton onClick={() => downloadText(`claimback-${doc.file}`, doc.text)}>
              Download .txt
            </TextButton>
            <TextButton onClick={onPrint}>Print or save PDF</TextButton>
          </div>
        </header>
        {missing.length > 0 && (
          <p className="px-5 pt-4 text-caption text-pen sm:px-7">
            Still to fill in by hand: {missing.join(", ")}
          </p>
        )}
        <pre className="whitespace-pre-wrap px-5 py-5 font-sans text-caption text-bill-text sm:px-7">
          {doc.text}
        </pre>
      </div>
    </article>
  );
}
