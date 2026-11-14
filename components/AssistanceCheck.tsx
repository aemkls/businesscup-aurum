"use client";

import { useState } from "react";
import { saveCase, type StoredCase } from "@/lib/caseStore";
import {
  assistanceTier,
  fplPercent,
  povertyGuideline,
  type Region,
} from "@/lib/engine/assistance";
import { usd } from "@/lib/engine/money";

const COPY = {
  free: {
    title: "You may qualify for free care",
    text: "Many hospital assistance policies cover 100% of the bill at this income. Apply before you pay anything.",
  },
  discount: {
    title: "You may qualify for a discount",
    text: "Many hospital assistance policies give a sliding-scale discount at this income. It applies on top of the corrections above.",
  },
  unlikely: {
    title: "Assistance is less likely at this income",
    text: "Most policies stop below 400% of the poverty line. Some hospitals still reduce large bills on request, so it can be worth asking.",
  },
} as const;

/**
 * Charity care screening. Nonprofit hospitals must offer financial assistance
 * under IRS rules, but almost nobody who checks a bill for errors also checks
 * this. Answers stay in the browser.
 */
export function AssistanceCheck({ saved }: { saved: StoredCase }) {
  const initial = saved.household;
  const [size, setSize] = useState(String(initial?.size ?? 3));
  const [income, setIncome] = useState(initial ? String(initial.annualIncome) : "");
  const [region, setRegion] = useState<Region>(initial?.region ?? "contiguous");

  const household = saved.household;
  const percent = household ? fplPercent(household) : null;
  const tier = percent === null ? null : assistanceTier(percent);

  function check(event: React.FormEvent) {
    event.preventDefault();
    const next = { size: Number(size), annualIncome: Number(income), region };
    if (!(next.size >= 1) || !(next.annualIncome >= 0) || income === "") return;
    saveCase({ ...saved, household: next });
  }

  return (
    <section className="no-print mt-10 rounded-lg border border-line bg-card p-6">
      <h2 className="text-xl font-semibold">Can the hospital forgive part of this bill?</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Nonprofit hospitals are required by federal tax rules to have a financial assistance
        policy, and you can usually apply after you receive the bill. Two numbers tell you where
        you stand. They stay on this device.
      </p>

      <form onSubmit={check} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-muted">People in household</span>
          <input
            type="number"
            min={1}
            max={20}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="money mt-1 block w-24 rounded-lg border border-line bg-paper px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Yearly household income</span>
          <span className="mt-1 flex items-center rounded-lg border border-line bg-paper">
            <span className="money pl-3 text-muted">$</span>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="65000"
              className="money w-36 bg-transparent px-2 py-2 outline-none"
            />
          </span>
        </label>
        <label className="block">
          <span className="text-xs text-muted">State</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as Region)}
            className="mt-1 block rounded-lg border border-line bg-paper px-3 py-2"
          >
            <option value="contiguous">Lower 48 or DC</option>
            <option value="alaska">Alaska</option>
            <option value="hawaii">Hawaii</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={income === ""}
          className="rounded-lg border border-ink/25 bg-paper px-4 py-2 font-medium hover:border-ink disabled:opacity-50"
        >
          Check
        </button>
      </form>

      {household && tier && percent !== null && (
        <div
          className={`mt-5 rounded-lg px-4 py-3 ${tier === "unlikely" ? "bg-paper" : "bg-accent-soft"}`}
        >
          <p className="font-semibold">{COPY[tier].title}</p>
          <p className="mt-1 text-sm leading-relaxed">
            Your income is <span className="money font-medium">{percent}%</span> of the 2026
            federal poverty guideline for {household.size}{" "}
            {household.size === 1 ? "person" : "people"} (
            <span className="money">{usd(povertyGuideline(household.size, household.region))}</span>
            ). {COPY[tier].text}
          </p>
          {tier !== "unlikely" && (
            <p className="mt-2 text-sm text-muted">
              {saved.letters
                ? "Your request letter is in your documents above, and the step is in your plan."
                : "Unlocking your case adds a ready-to-send request for the hospital's assistance application."}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Each hospital sets its own limits. This is a screening, not an approval.
          </p>
        </div>
      )}
    </section>
  );
}
