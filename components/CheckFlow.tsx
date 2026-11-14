"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sampleBill, sampleEob, samplePlan } from "@/data/samples/sample";
import { saveCase } from "@/lib/caseStore";
import { billToText, eobToText } from "@/lib/documentText";
import type { AnalysisResult, PlanInfo } from "@/lib/types";

const PROGRESS = [
  "Reading your bill",
  "Reading your EOB",
  "Checking every line against your plan",
  "Writing up what we found",
];

type PlanForm = Record<Exclude<keyof PlanInfo, "inNetwork">, string> & { inNetwork: boolean };

const EMPTY: PlanForm = {
  deductible: "",
  deductibleMet: "",
  coinsurancePct: "20",
  oopMax: "",
  oopMet: "",
  copay: "0",
  inNetwork: true,
};

const FIELDS: { key: Exclude<keyof PlanInfo, "inNetwork">; label: string; hint: string; unit: string }[] = [
  { key: "deductible", label: "Annual deductible", hint: "What you pay before the plan starts paying.", unit: "$" },
  { key: "deductibleMet", label: "Deductible already paid this year", hint: "Before this visit. Your insurer portal shows it.", unit: "$" },
  { key: "coinsurancePct", label: "Coinsurance", hint: "Your share after the deductible. Often 20%.", unit: "%" },
  { key: "oopMax", label: "Out-of-pocket maximum", hint: "The most you can pay in a year.", unit: "$" },
  { key: "oopMet", label: "Out-of-pocket already paid this year", hint: "Before this visit.", unit: "$" },
  { key: "copay", label: "Copay for this visit", hint: "Flat fee for this type of visit, e.g. an ER copay. 0 if none.", unit: "$" },
];

function toForm(plan: PlanInfo): PlanForm {
  return {
    deductible: String(plan.deductible),
    deductibleMet: String(plan.deductibleMet),
    coinsurancePct: String(plan.coinsurancePct),
    oopMax: String(plan.oopMax),
    oopMet: String(plan.oopMet),
    copay: String(plan.copay),
    inNetwork: plan.inNetwork,
  };
}

export function CheckFlow({ sample }: { sample: boolean }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanForm>(sample ? toForm(samplePlan) : EMPTY);
  const [bill, setBill] = useState<File | null>(null);
  const [eob, setEob] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");

  // Advance the progress label while the request is in flight.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(
      () => setStage((s) => Math.min(s + 1, PROGRESS.length - 1)),
      5000,
    );
    return () => clearInterval(timer);
  }, [busy]);

  const planReady = FIELDS.every((f) => plan[f.key] !== "" && Number(plan[f.key]) >= 0);
  const ready = planReady && (sample || bill !== null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setStage(0);
    setError("");

    const body = new FormData();
    body.set(
      "plan",
      JSON.stringify({
        deductible: Number(plan.deductible),
        deductibleMet: Number(plan.deductibleMet),
        coinsurancePct: Number(plan.coinsurancePct),
        oopMax: Number(plan.oopMax),
        oopMet: Number(plan.oopMet),
        copay: Number(plan.copay),
        inNetwork: plan.inNetwork,
      }),
    );
    if (sample) body.set("sample", "1");
    if (bill) body.set("bill", bill);
    if (eob) body.set("eob", eob);

    try {
      const response = await fetch("/api/analyze", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
      saveCase({
        result: data as AnalysisResult,
        createdAt: new Date().toISOString(),
        letters: null,
        done: {},
      });
      router.push("/results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        {sample ? "Sample case: an ER visit" : "Check my bill"}
      </h1>
      {sample && (
        <p className="mt-3 rounded-lg bg-accent-soft px-4 py-3 text-sm leading-relaxed">
          This is an invented patient with an invented hospital bill. The plan numbers below are
          filled in for you. The check itself is the real one: the documents go through the same
          reader and the same rules as an uploaded bill.
        </p>
      )}

      <section className="mt-10">
        <StepHeading n={1} title="Your plan" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="block">
              <span className="text-sm font-medium">{field.label}</span>
              <span className="mt-1 flex items-center rounded-lg border border-line bg-card focus-within:border-accent">
                <span className="money pl-3 text-muted">{field.unit}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  required
                  value={plan[field.key]}
                  onChange={(e) => setPlan({ ...plan, [field.key]: e.target.value })}
                  className="money w-full bg-transparent px-2 py-2.5 outline-none"
                />
              </span>
              <span className="mt-1 block text-xs text-muted">{field.hint}</span>
            </label>
          ))}
          <fieldset>
            <legend className="text-sm font-medium">Was the provider in your network?</legend>
            <div className="mt-1 flex gap-2">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setPlan({ ...plan, inNetwork: value })}
                  className={`rounded-lg border px-4 py-2.5 text-sm ${
                    plan.inNetwork === value
                      ? "border-accent bg-accent-soft font-medium"
                      : "border-line bg-card"
                  }`}
                >
                  {value ? "In-network" : "Out-of-network"}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section className="mt-10">
        <StepHeading n={2} title="Your documents" />
        {sample ? (
          <div className="mt-4 space-y-3">
            <DocumentPreview title="Hospital bill (sample)" text={billToText(sampleBill)} open />
            <DocumentPreview title="Explanation of Benefits (sample)" text={eobToText(sampleEob)} />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FileField
              label="Itemized bill"
              hint="Required. Photo or PDF. Ask the hospital for the itemized version."
              file={bill}
              onChange={setBill}
            />
            <FileField
              label="Explanation of Benefits (EOB)"
              hint="Optional, but it unlocks most checks. Download it from your insurer portal."
              file={eob}
              onChange={setEob}
            />
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Files are read in memory to run the check and are not saved on our servers.
        </p>
      </section>

      <div className="mt-10">
        <button
          type="submit"
          disabled={!ready || busy}
          className="rounded-lg bg-accent px-6 py-3 font-medium text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? `${PROGRESS[stage]}…` : "Run the check"}
        </button>
        {busy && (
          <p className="mt-3 text-sm text-muted" aria-live="polite">
            This usually takes 15 to 40 seconds. Step {stage + 1} of {PROGRESS.length}.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-baseline gap-3 text-xl font-semibold">
      <span className="money text-sm text-accent">0{n}</span>
      {title}
    </h2>
  );
}

function FileField({
  label,
  hint,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-lg border border-dashed border-ink/30 bg-card p-5 hover:border-accent">
      <span className="font-medium">{label}</span>
      <span className="mt-1 block text-xs text-muted">{hint}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <span className={`mt-4 block text-sm ${file ? "text-accent" : "text-muted"}`}>
        {file ? file.name : "Choose a file"}
      </span>
    </label>
  );
}

function DocumentPreview({ title, text, open }: { title: string; text: string; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg border border-line bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{title}</summary>
      <pre className="overflow-x-auto border-t border-line px-4 py-3 font-mono text-[11px] leading-relaxed">
        {text}
      </pre>
    </details>
  );
}
