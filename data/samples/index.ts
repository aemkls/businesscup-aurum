import type { Bill, Eob, PlanInfo } from "@/lib/types";
import { physicalBill, physicalEob, physicalPlan } from "./physical";
import { sampleBill, sampleEob, samplePlan } from "./sample";

/** The two synthetic cases a visitor can try without uploading anything. */
export type SampleKind = "er" | "physical";

export interface SampleCase {
  kind: SampleKind;
  label: string;
  /** One line shown next to the choice. */
  summary: string;
  plan: PlanInfo;
  bill: Bill;
  eob: Eob;
}

export const SAMPLES: Record<SampleKind, SampleCase> = {
  er: {
    kind: "er",
    label: "ER visit",
    summary: "An emergency room visit billed at $3,729.80.",
    plan: samplePlan,
    bill: sampleBill,
    eob: sampleEob,
  },
  physical: {
    kind: "physical",
    label: "Annual physical",
    summary: "A “free” yearly checkup that came back with a $407.00 bill.",
    plan: physicalPlan,
    bill: physicalBill,
    eob: physicalEob,
  },
};

/** Reads ?sample= from the URL: "1" and "er" mean the ER visit. */
export function sampleFromParam(value: string | null): SampleKind | null {
  if (value === "1" || value === "er") return "er";
  if (value === "physical") return "physical";
  return null;
}
