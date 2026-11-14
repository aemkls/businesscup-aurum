/**
 * Financial assistance ("charity care") screening.
 *
 * Nonprofit hospitals must have a written financial assistance policy under
 * IRS section 501(r). Eligibility is set by each hospital, usually as a
 * percentage of the federal poverty guidelines. This module only says where
 * a household stands against those guidelines; it never promises approval.
 */

export type Region = "contiguous" | "alaska" | "hawaii";

/** HHS poverty guidelines for 2026: [one person, each additional person]. */
const GUIDELINES_2026: Record<Region, [number, number]> = {
  contiguous: [15960, 5680],
  alaska: [19950, 7100],
  hawaii: [18360, 6530],
};

export interface Household {
  size: number;
  annualIncome: number;
  region: Region;
}

export type AssistanceTier = "free" | "discount" | "unlikely";

export function povertyGuideline(size: number, region: Region): number {
  const [base, perPerson] = GUIDELINES_2026[region];
  return base + Math.max(0, Math.floor(size) - 1) * perPerson;
}

/** Household income as a percentage of the poverty guideline, rounded. */
export function fplPercent(household: Household): number {
  return Math.round((household.annualIncome / povertyGuideline(household.size, household.region)) * 100);
}

/**
 * Common thresholds in hospital policies: free care up to 200% of the
 * guideline, sliding-scale discounts up to 400%. Individual hospitals vary.
 */
export function assistanceTier(percent: number): AssistanceTier {
  if (percent <= 200) return "free";
  if (percent <= 400) return "discount";
  return "unlikely";
}

export function validHousehold(value: unknown): value is Household {
  const h = value as Household;
  return (
    typeof h === "object" &&
    h !== null &&
    Number.isFinite(h.size) &&
    h.size >= 1 &&
    h.size <= 20 &&
    Number.isFinite(h.annualIncome) &&
    h.annualIncome >= 0 &&
    h.annualIncome < 10_000_000 &&
    (h.region === "contiguous" || h.region === "alaska" || h.region === "hawaii")
  );
}
