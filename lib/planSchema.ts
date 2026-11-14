import { z } from "zod";

/** Validates the plan form on the server. */
export const planSchema = z
  .object({
    deductible: z.number().min(0).max(100000),
    deductibleMet: z.number().min(0).max(100000),
    coinsurancePct: z.number().min(0).max(100),
    oopMax: z.number().min(0).max(1000000),
    oopMet: z.number().min(0).max(1000000),
    inNetwork: z.boolean(),
  })
  .transform((p) => ({
    ...p,
    // A deductible cannot be more than fully met.
    deductibleMet: Math.min(p.deductibleMet, p.deductible),
    oopMet: Math.min(p.oopMet, p.oopMax),
  }));
