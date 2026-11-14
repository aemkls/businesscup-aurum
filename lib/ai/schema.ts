import { z } from "zod";

/**
 * Zod schemas for what the model must return when it reads the documents.
 * They mirror Bill and Eob in lib/types.ts and double as the JSON schema
 * sent to Gemini for structured output.
 */

const money = z.number().describe("US dollars, e.g. 1420.5. Use 0 if not shown.");

export const billSchema = z.object({
  provider: z.string().describe("Hospital or clinic name"),
  statementDate: z.string().describe("ISO date yyyy-mm-dd, or empty string"),
  lines: z.array(
    z.object({
      date: z.string().describe("Date of service, ISO yyyy-mm-dd"),
      code: z.string().describe("CPT or HCPCS code exactly as printed, or empty string"),
      description: z.string(),
      quantity: z.number().describe("Units. 1 if not shown."),
      charge: money.describe("Total charge for the line"),
    }),
  ),
  totalCharges: money,
  insurancePaid: money.describe("Insurance payments, as a positive number"),
  adjustments: money.describe("Insurance or contractual adjustments, as a positive number"),
  amountDue: money.describe("Balance the patient is asked to pay"),
});

export const eobSchema = z.object({
  insurer: z.string(),
  claimNumber: z.string(),
  lines: z.array(
    z.object({
      date: z.string(),
      code: z.string(),
      description: z.string(),
      billed: money,
      allowed: money,
      insurerPaid: money,
      patientResponsibility: money,
      status: z.enum(["paid", "denied"]).describe("denied if the insurer refused the line"),
      denialReason: z.string().describe("Reason or remark text for a denied line, else empty"),
    }),
  ),
  deductibleApplied: money,
  coinsuranceApplied: money,
  totalPatientResponsibility: money,
});

export const extractionSchema = z.object({
  isMedicalBill: z
    .boolean()
    .describe("false if the first document is not a medical bill or statement"),
  bill: billSchema,
  eob: eobSchema.nullable().describe("null if no Explanation of Benefits was provided"),
});

export type Extraction = z.infer<typeof extractionSchema>;

export const explanationsSchema = z.object({
  explanations: z.array(z.object({ id: z.string(), explanation: z.string() })),
});

export const lettersSchema = z.object({
  providerLetter: z.string(),
  insurerAppeal: z.string(),
  callScript: z.string(),
});
