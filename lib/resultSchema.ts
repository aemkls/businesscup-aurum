import { z } from "zod";
import { billSchema, eobSchema } from "./ai/schema";

/** Shape check for an AnalysisResult coming back from the browser. */
export const resultSchema = z.object({
  plan: z.object({
    deductible: z.number(),
    deductibleMet: z.number(),
    coinsurancePct: z.number(),
    oopMax: z.number(),
    oopMet: z.number(),
    copay: z.number().default(0), // cases saved before copay existed
    inNetwork: z.boolean(),
  }),
  bill: billSchema,
  eob: eobSchema.nullable(),
  findings: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum([
          "duplicate_charge",
          "quantity_anomaly",
          "balance_billing",
          "bill_exceeds_eob",
          "plan_math",
          "denied_claim",
          "surprise_bill",
          "preventive_cost_sharing",
          "split_visit",
        ]),
        title: z.string().max(300),
        amount: z.number(),
        confidence: z.enum(["high", "medium", "low"]),
        target: z.enum(["provider", "insurer"]),
        explanation: z.string().max(2000),
        evidence: z.array(z.string().max(500)).max(12),
        codes: z.array(z.string().max(20)).max(40),
      }),
    )
    .max(40),
  amountBilled: z.number(),
  potentialSavings: z.number(),
  fairAmount: z.number(),
  meta: z.object({
    aiExtraction: z.boolean(),
    aiExplanations: z.boolean(),
    model: z.string().nullable(),
    hasEob: z.boolean(),
  }),
});
