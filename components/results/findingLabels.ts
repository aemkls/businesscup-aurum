import type { Confidence, Finding } from "@/lib/types";

/** Short status words for the annotated bill and the finding chips. */
export const SHORT_LABEL: Record<Finding["type"], string> = {
  duplicate_charge: "Duplicate",
  quantity_anomaly: "Wrong quantity",
  balance_billing: "Above insurer rate",
  bill_exceeds_eob: "Above EOB",
  plan_math: "Plan math",
  denied_claim: "Denied, appealable",
  surprise_bill: "Surprise bill",
};

export const CONFIDENCE: Record<Confidence, { label: string; tone: "ok" | "flag" | "neutral" }> = {
  high: { label: "High confidence", tone: "ok" },
  medium: { label: "Medium confidence", tone: "flag" },
  low: { label: "Low confidence", tone: "neutral" },
};

export const findingNumber = (index: number) => String(index + 1).padStart(2, "0");
