import Link from "next/link";
import { ResumeCase } from "@/components/ResumeCase";

const STEPS = [
  {
    title: "Tell us your plan",
    text: "Four numbers from your insurance card or portal: deductible, what you have paid so far, coinsurance and out-of-pocket max.",
  },
  {
    title: "Add the bill and the EOB",
    text: "A photo or PDF of the hospital bill and the Explanation of Benefits your insurer sent for the same visit.",
  },
  {
    title: "See what you should not owe",
    text: "Duplicates, wrong quantities, charges above your insurer's rate, deductible mistakes and denials you can appeal.",
  },
];

export default function Home() {
  return (
    <div>
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Medical bill check
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Your hospital bill is probably wrong. Find out by how much.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted">
          ClaimBack reads your bill and your insurer&apos;s EOB, checks both against the terms of
          your own plan and shows, line by line, what you should not be paying. Then it writes the
          dispute letter and the appeal for you.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/check"
            className="rounded-lg bg-accent px-6 py-3 font-medium text-white hover:bg-accent-dark"
          >
            Check my bill
          </Link>
          <Link
            href="/check?sample=1"
            className="rounded-lg border border-ink/25 bg-card px-6 py-3 font-medium hover:border-ink"
          >
            Try with a sample bill
          </Link>
        </div>
        <p className="mt-3 text-sm text-muted">
          Free to see what we find. About two minutes, no sign-up.
        </p>
        <ResumeCase />
      </section>

      <section className="mt-16 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.title} className="bg-card p-6">
            <p className="money text-sm text-accent">0{i + 1}</p>
            <h2 className="mt-2 font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 grid gap-6 sm:grid-cols-3">
        <Stat value="19%" text="of in-network claims on HealthCare.gov were denied in 2023." />
        <Stat value="1 in 200" text="denied claims is ever appealed by the patient." />
        <Stat value="44%" text="of those appeals end with the insurer reversing its decision." />
        <p className="text-xs text-muted sm:col-span-3">
          Source: KFF, Claims Denials and Appeals in ACA Marketplace Plans in 2023 (published
          January 2025).
        </p>
      </section>
    </div>
  );
}

function Stat({ value, text }: { value: string; text: string }) {
  return (
    <div className="border-l-2 border-accent pl-4">
      <p className="money text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
    </div>
  );
}
