import { ResumeCase } from "@/components/ResumeCase";
import { ButtonLink } from "@/components/ui";

const STEPS = [
  {
    title: "Tell us your plan",
    text: "Deductible, what you have paid this year, coinsurance, out-of-pocket max, copay.",
  },
  {
    title: "Add the bill and the EOB",
    text: "A photo or PDF of the itemized bill and your insurer's Explanation of Benefits.",
  },
  {
    title: "See what you should not owe",
    text: "Every problem with its amount and evidence, plus the letters to get it fixed.",
  },
];

const STATS = [
  { value: "19%", text: "of in-network claims on HealthCare.gov were denied in 2023." },
  { value: "1 in 200", text: "denied claims is ever appealed by the patient." },
  { value: "44%", text: "of those appeals end with the insurer reversing its decision." },
];

export default function Home() {
  return (
    <>
      <section className="bg-tile-dark px-4 py-12 text-on-dark sm:px-6 md:py-16">
        <div className="rise mx-auto max-w-[980px] text-center">
          <h1 className="text-hero-sm font-semibold md:text-hero">
            Your hospital bill is probably wrong.
            <br className="hidden sm:block" /> Find out by how much.
          </h1>
          <p className="mx-auto mt-4 max-w-[600px] text-tagline font-normal text-on-dark-muted">
            We check your bill and EOB against your own plan and show, line by line, what you
            should not pay.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/check?sample=1" className="w-full max-w-[280px] sm:w-auto">
              Try with a sample bill
            </ButtonLink>
            <ButtonLink href="/check" variant="secondaryOnDark" className="w-full max-w-[280px] sm:w-auto">
              Check my bill
            </ButtonLink>
          </div>
          <p className="mt-4 text-caption text-on-dark-muted">About two minutes. No sign-up.</p>
          <ResumeCase />
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6">
        <ol className="mx-auto grid max-w-[980px] gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <p className="money text-caption font-semibold text-ink-muted">Step {i + 1}</p>
              <h2 className="mt-1 text-tagline font-semibold">{step.title}</h2>
              <p className="mt-2 text-caption text-ink-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-parchment px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-[980px]">
          <dl className="grid gap-8 sm:grid-cols-3">
            {STATS.map((stat) => (
              <div key={stat.value}>
                <dt className="money text-section-sm font-semibold md:text-section">{stat.value}</dt>
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
