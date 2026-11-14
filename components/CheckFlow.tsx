"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { sampleBill, sampleEob, samplePlan } from "@/data/samples/sample";
import { saveCase } from "@/lib/caseStore";
import { billToText, eobToText } from "@/lib/documentText";
import { loadPlanDraft, savePlanDraft } from "@/lib/planDraft";
import type { AnalysisResult, PlanInfo } from "@/lib/types";
import { Button, ErrorNote, Section, TextButton } from "./ui";

type NumberField = Exclude<keyof PlanInfo, "inNetwork">;
type PlanForm = Record<NumberField, string> & { inNetwork: boolean };

const EMPTY: PlanForm = {
  deductible: "",
  deductibleMet: "",
  coinsurancePct: "20",
  oopMax: "",
  oopMet: "",
  copay: "0",
  inNetwork: true,
};

/** Each plan field, with a short answer to "Where do I find this?". */
const FIELDS: { key: NumberField; label: string; unit: "$" | "%"; help: string }[] = [
  {
    key: "deductible",
    label: "Annual deductible",
    unit: "$",
    help: 'On your plan\'s Summary of Benefits and Coverage, as "Overall deductible". Use the individual amount, not the family one.',
  },
  {
    key: "deductibleMet",
    label: "Deductible paid this year",
    unit: "$",
    help: 'Your insurer\'s app or website shows it on the Benefits page, e.g. "$500 of $1,500 met". Use the amount from before this visit.',
  },
  {
    key: "coinsurancePct",
    label: "Coinsurance",
    unit: "%",
    help: 'Your share after the deductible. The Summary of Benefits lists it for hospital and emergency care, e.g. "20% coinsurance".',
  },
  {
    key: "oopMax",
    label: "Out-of-pocket maximum",
    unit: "$",
    help: 'Listed next to the deductible on the Summary of Benefits, as "Out-of-pocket limit". It is the most you pay in a plan year.',
  },
  {
    key: "oopMet",
    label: "Out-of-pocket paid this year",
    unit: "$",
    help: "Shown in your insurer portal next to the deductible progress. Use the amount from before this visit.",
  },
  {
    key: "copay",
    label: "Copay for this visit",
    unit: "$",
    help: 'A flat fee for this type of visit, often printed on your insurance card (e.g. "ER $250"). Enter 0 if there is none.',
  },
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

function toPlan(form: PlanForm): PlanInfo {
  return {
    deductible: Number(form.deductible),
    deductibleMet: Number(form.deductibleMet),
    coinsurancePct: Number(form.coinsurancePct),
    oopMax: Number(form.oopMax),
    oopMet: Number(form.oopMet),
    copay: Number(form.copay),
    inNetwork: form.inNetwork,
  };
}

/** Returns a message for the first invalid field, or "" when the plan is complete. */
function planProblem(form: PlanForm): string {
  for (const field of FIELDS) {
    const raw = form[field.key];
    if (raw === "") return `Enter your ${field.label.toLowerCase()}.`;
    if (!(Number(raw) >= 0)) return `${field.label} cannot be negative.`;
  }
  if (Number(form.coinsurancePct) > 100) return "Coinsurance is a percentage from 0 to 100.";
  if (Number(form.deductibleMet) > Number(form.deductible)) {
    return "The deductible paid this year cannot be more than the deductible.";
  }
  return "";
}

type Failure = { message: string; busy: boolean };

export function CheckFlow({ sample }: { sample: boolean }) {
  const router = useRouter();
  // This component only renders in the browser (it sits under useSearchParams
  // in a Suspense boundary), so reading localStorage here is safe.
  const [plan, setPlanState] = useState<PlanForm>(() =>
    sample ? toForm(samplePlan) : loadPlanDraft(EMPTY),
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [showProblem, setShowProblem] = useState(false);
  const [bill, setBill] = useState<File | null>(null);
  const [eob, setEob] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  function setPlan(next: PlanForm) {
    setPlanState(next);
    if (!sample) savePlanDraft(next);
  }

  const problem = planProblem(plan);

  function next(event: React.FormEvent) {
    event.preventDefault();
    if (problem) {
      setShowProblem(true);
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  async function run() {
    if (running || (!sample && !bill)) return;
    setRunning(true);
    setFailure(null);
    const body = new FormData();
    body.set("plan", JSON.stringify(toPlan(plan)));
    if (sample) body.set("sample", "1");
    if (bill) body.set("bill", bill);
    if (eob) body.set("eob", eob);
    try {
      const response = await fetch("/api/analyze", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFailure({
          message: data.error ?? "Something went wrong. Please try again.",
          busy: response.status === 503,
        });
        setRunning(false);
        return;
      }
      saveCase({
        result: data as AnalysisResult,
        createdAt: new Date().toISOString(),
        letters: null,
        done: {},
      });
      router.push("/results");
    } catch {
      setFailure({ message: "We could not reach the server. Check your connection.", busy: false });
      setRunning(false);
    }
  }

  return (
    <Section>
      <div className="mx-auto max-w-[640px]">
        <p className="text-caption font-semibold text-ink-muted">
          {sample ? "Sample case: an ER visit" : "Check my bill"} · Step {step} of 2
        </p>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-desk-deep"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={2}
          aria-valuenow={step}
        >
          <div
            className="h-full rounded-full bg-action transition-[width] duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>

        {step === 1 ? (
          <form onSubmit={next} noValidate>
            <h1 className="mt-8 text-section-sm font-extrabold md:text-section">Your plan</h1>
            <p className="mt-3 text-body text-ink-muted">
              {sample
                ? "An invented patient's plan, filled in for you. The check after this is the real one."
                : "Copy six numbers from your insurance portal or plan summary. We keep them in this browser."}
            </p>
            {!sample && (
              <TextButton onClick={() => setPlan(toForm(samplePlan))} className="mt-2">
                Fill from sample
              </TextButton>
            )}

            <div className="paper-shadow -mx-4 mt-8 sm:mx-0">
              <div className="paper overflow-hidden sm:rounded-[18px]">
                <div className="flex items-center justify-between gap-4 bg-ink px-5 py-4 text-white sm:px-7">
                  <span className="display text-tagline font-bold">Health plan</span>
                  <span className="font-mono text-fine text-white/80">Member plan card</span>
                </div>
                <div className="grid gap-x-8 gap-y-6 px-5 py-6 sm:grid-cols-2 sm:px-7">
                  {FIELDS.map((field) => (
                    <PlanField
                      key={field.key}
                      field={field}
                      value={plan[field.key]}
                      onChange={(value) => setPlan({ ...plan, [field.key]: value })}
                    />
                  ))}
                  <fieldset className="sm:col-span-2">
                    <legend className="text-fine font-semibold text-ink-muted">
                      Was the hospital in your network?
                    </legend>
                    <div className="mt-2 inline-flex rounded-full border border-rule p-1">
                      {[true, false].map((value) => (
                        <button
                          key={String(value)}
                          type="button"
                          aria-pressed={plan.inNetwork === value}
                          onClick={() => setPlan({ ...plan, inNetwork: value })}
                          className={`rounded-full px-4 py-2 text-caption ${
                            plan.inNetwork === value
                              ? "bg-ink font-semibold text-white"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          {value ? "In-network" : "Out-of-network"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>
            </div>

            {showProblem && problem && (
              <p role="alert" className="mt-6 text-caption font-semibold text-pen">
                {problem}
              </p>
            )}
            <div className="mt-8">
              <Button type="submit">Continue</Button>
            </div>
          </form>
        ) : (
          <div>
            <h1 className="mt-8 text-section-sm font-extrabold md:text-section">Your documents</h1>
            {running ? (
              <AnalysisProgress hasEob={sample || eob !== null} />
            ) : (
              <>
                <p className="mt-3 text-body text-ink-muted">
                  {sample
                    ? "The sample bill and EOB below go through the same AI reader and rules as an upload."
                    : "We read your files in memory to run the check and never save them."}
                </p>

                {sample ? (
                  <div className="mt-8 space-y-3">
                    <DocumentPreview title="Hospital bill (sample)" text={billToText(sampleBill)} />
                    <DocumentPreview
                      title="Explanation of Benefits (sample)"
                      text={eobToText(sampleEob)}
                    />
                  </div>
                ) : (
                  <div className="mt-8 grid gap-6 sm:grid-cols-2">
                    <FileField
                      label="Drop your bill here"
                      hint="The itemized bill. Required. Photo or PDF."
                      file={bill}
                      onChange={setBill}
                    />
                    <FileField
                      label="Drop your EOB here"
                      hint="From your insurer. Optional, but most checks need it."
                      file={eob}
                      onChange={setEob}
                    />
                    <p className="text-caption text-ink-muted sm:col-span-2">
                      No bill at hand? Download a sample and upload it:{" "}
                      <a
                        href="/samples/sample-bill.jpg"
                        download
                        className="font-semibold text-action hover:underline"
                      >
                        bill photo
                      </a>
                      ,{" "}
                      <a
                        href="/samples/sample-bill.pdf"
                        download
                        className="font-semibold text-action hover:underline"
                      >
                        bill PDF
                      </a>
                      ,{" "}
                      <a
                        href="/samples/sample-eob.pdf"
                        download
                        className="font-semibold text-action hover:underline"
                      >
                        EOB PDF
                      </a>
                      .
                    </p>
                  </div>
                )}

                {failure && (
                  <div className="mt-8 space-y-3">
                    <ErrorNote>{failure.message}</ErrorNote>
                    {failure.busy && !sample && (
                      <p className="text-caption text-ink-muted">
                        The free AI reader is sometimes overloaded for a minute. You can also{" "}
                        <Link
                          href="/check?sample=1"
                          className="font-semibold text-action hover:underline"
                        >
                          try the sample bill
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button onClick={run} disabled={!sample && !bill}>
                    {failure ? "Try again" : "Run the check"}
                  </Button>
                  <TextButton onClick={() => setStep(1)}>Back to your plan</TextButton>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}

function PlanField({
  field,
  value,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-fine font-semibold text-ink-muted">
          {field.label}
        </label>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-help`}
          aria-label={`Where do I find my ${field.label.toLowerCase()}?`}
          title="Where do I find this?"
          onClick={() => setOpen(!open)}
          className="flex size-5 items-center justify-center rounded-full border border-rule text-fine font-semibold text-ink-muted hover:border-action hover:text-action"
        >
          ?
        </button>
      </div>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-mono text-tagline text-ink-muted">
          {field.unit}
        </span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full border-0 border-b-2 border-rule bg-transparent pl-6 font-mono text-tagline text-bill-text outline-none focus:border-action"
        />
      </div>
      {open && (
        <p id={`${id}-help`} className="mt-2 text-caption text-ink-muted">
          <span className="font-semibold text-ink">Where to find it: </span>
          {field.help}
        </p>
      )}
    </div>
  );
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf";

/** An empty sheet with a dashed border; after a file is chosen, its thumbnail and name. */
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
  const [over, setOver] = useState(false);
  const preview = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onChange(e.dataTransfer.files?.[0] ?? null);
      }}
      className="paper-shadow -mx-4 block cursor-pointer sm:mx-0"
    >
      <span
        className={`paper flex min-h-[220px] flex-col items-center justify-center border-2 border-dashed p-6 text-center sm:rounded-[4px] ${
          over ? "border-action" : file ? "border-rule" : "border-rule hover:border-action"
        }`}
      >
        {file ? (
          <>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview, not a hosted image
              <img
                src={preview}
                alt=""
                className="h-28 w-auto max-w-full rounded-[2px] border border-rule object-contain"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <span className="flex h-28 w-20 items-center justify-center rounded-[2px] border border-rule font-mono text-caption font-semibold text-ink-muted">
                PDF
              </span>
            )}
            <span className="mt-3 max-w-full truncate font-mono text-caption text-bill-text">
              {file.name}
            </span>
            <span className="mt-1 text-caption font-semibold text-action">Choose another file</span>
          </>
        ) : (
          <>
            <span className="display text-tagline font-bold text-ink">{label}</span>
            <span className="mt-2 text-caption text-ink-muted">{hint}</span>
            <span className="mt-4 text-caption font-semibold text-action">or choose a file</span>
          </>
        )}
      </span>
      <input
        type="file"
        accept={ACCEPT}
        aria-label={label}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function DocumentPreview({ title, text }: { title: string; text: string }) {
  return (
    <details className="paper-shadow -mx-4 sm:mx-0">
      <summary className="paper cursor-pointer px-5 py-4 text-body font-semibold text-ink sm:rounded-[4px]">
        {title}
      </summary>
      <pre className="paper overflow-x-auto px-5 pb-5 font-mono text-fine leading-relaxed text-bill-text">
        {text}
      </pre>
    </details>
  );
}

/**
 * What the server is doing, as a checklist ticked off in pen. The request
 * is a single call, so lines tick on a timer while it runs.
 */
function AnalysisProgress({ hasEob }: { hasEob: boolean }) {
  const steps = [
    "Upload your documents",
    "Read the bill",
    ...(hasEob ? ["Read the EOB"] : []),
    "Check every line against your plan",
    "Write up what we found",
  ];
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => Math.min(c + 1, steps.length - 1)), 4000);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="mt-8" aria-live="polite">
      <div className="paper-shadow -mx-4 sm:mx-0">
        <ol className="paper space-y-4 px-5 py-6 font-mono text-caption sm:rounded-[4px] sm:px-7">
          {steps.map((label, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={label} className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="relative size-5 shrink-0 rounded-[3px] border-2 border-bill-text/70"
                >
                  {done && (
                    <svg
                      viewBox="0 0 24 24"
                      className="absolute -left-1 -top-2 size-7 overflow-visible"
                    >
                      <path
                        d="M3 13 L9 19 L22 3"
                        pathLength={1}
                        fill="none"
                        stroke="var(--color-pen)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mark-stroke"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className={
                    done ? "text-bill-text" : active ? "font-semibold text-ink" : "text-ink-muted"
                  }
                >
                  {label}
                  {done && <span className="sr-only"> (done)</span>}
                  {active && <span className="sr-only"> (in progress)</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-4 text-caption text-ink-muted">This usually takes 10 to 40 seconds.</p>
    </div>
  );
}
