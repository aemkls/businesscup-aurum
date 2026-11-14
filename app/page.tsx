import Link from "next/link";
import { AuditedBill } from "@/components/AuditedBill";
import { ResumeCase } from "@/components/ResumeCase";
import { ButtonLink } from "@/components/ui";
import { sampleBill, sampleEob, samplePlan } from "@/data/samples/sample";
import { runEngine, summarize } from "@/lib/engine";

const STEPS = [
  {
    title: "Tell us your plan",
    text: "Your deductible, coinsurance, out-of-pocket max and copay, from your insurance portal.",
  },
  {
    title: "Add the bill and the EOB",
    text: "A photo or PDF of the itemized bill and your insurer's Explanation of Benefits.",
  },
  {
    title: "Get it corrected",
    text: "See every mistake with its amount and evidence, then send the letters we write for you.",
  },
];

const STATS = [
  { value: "19%", text: "of in-network claims on HealthCare.gov were denied in 2023." },
  { value: "1 in 200", text: "denied claims is ever appealed by the patient." },
  { value: "44%", text: "of those appeals end with the insurer reversing its decision." },
];

export default function Home() {
  // The hero bill is the sample case, marked up by the real rule engine.
  const findings = runEngine(sampleBill, sampleEob, samplePlan);
  const { fairAmount } = summarize(sampleBill, findings);

  return (
    <>
      <section className="px-4 pb-12 pt-6 sm:px-6 md:pb-20 md:pt-12">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-16">
          <div>
            <h1 className="text-hero-sm font-extrabold text-ink md:text-hero">
              Hospital bills are full of mistakes.{" "}
              <span className="relative isolate whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="mark-marker absolute inset-x-[-0.1em] bottom-[0.08em] top-[0.45em] -z-10 -skew-x-6 rounded-[3px] bg-marker"
                  style={{ "--d": "3300ms" } as React.CSSProperties}
                />
                We find yours.
              </span>
            </h1>
            <p className="mt-5 max-w-[520px] text-lead text-ink-muted">
              Add your plan and your bill. We check every line against your insurance and mark what
              you likely don&apos;t owe.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/check?sample=er" className="w-full sm:w-auto">
                Try with a sample bill
              </ButtonLink>
              <ButtonLink href="/check" variant="secondary" className="w-full sm:w-auto">
                Check my bill
              </ButtonLink>
            </div>
            <p className="mt-4 text-caption text-ink-muted">
              Two samples to try: an{" "}
              <Link href="/check?sample=er" className="font-semibold text-action hover:underline">
                ER visit
              </Link>{" "}
              or a &ldquo;free&rdquo;{" "}
              <Link
                href="/check?sample=physical"
                className="font-semibold text-action hover:underline"
              >
                annual physical
              </Link>
              .
            </p>
            <p className="mt-1 text-caption text-ink-muted">
              About two minutes. No sign-up. We never store your files.
            </p>
            <ResumeCase />
          </div>
          <AuditedBill
            bill={sampleBill}
            findings={findings}
            fairAmount={fairAmount}
            label={`A sample hospital bill marked up by ClaimBack: ${findings.length} problems, amount due corrected from $3,729.80 to $1,182.80.`}
          />
        </div>
      </section>

      <section className="border-t border-rule px-4 py-12 sm:px-6">
        <ol className="mx-auto grid max-w-[1200px] gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="font-mono text-caption font-semibold text-ink-muted">0{i + 1}</span>
              <div>
                <h2 className="text-tagline font-bold">{step.title}</h2>
                <p className="mt-2 text-caption text-ink-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-rule px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-[1200px]">
          <dl className="grid gap-8 sm:grid-cols-3">
            {STATS.map((stat) => (
              <div key={stat.value}>
                <dt className="font-mono text-section-sm font-semibold tracking-tight text-ink md:text-section">
                  {stat.value}
                </dt>
                <dd className="mt-2 text-caption text-ink-muted">{stat.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-fine text-ink-muted">
            Source: KFF, Claims Denials and Appeals in ACA Marketplace Plans in 2023 (January 2025).
          </p>
        </div>
      </section>
    </>
  );
}
