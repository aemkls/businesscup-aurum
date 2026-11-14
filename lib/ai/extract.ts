import type { Part } from "@google/genai";
import { cents, sum } from "../engine/money";
import type { Bill, Eob } from "../types";
import { generateJson } from "./client";
import { extractionSchema, type Extraction } from "./schema";

/** A document to read: either an uploaded file or plain text. */
export type DocumentInput =
  | { kind: "file"; mimeType: string; base64: string }
  | { kind: "text"; text: string };

const SYSTEM = `You transcribe US medical billing documents into structured data.
Copy codes, quantities and dollar amounts exactly as printed. Never estimate,
correct or invent a value. If a field is not on the document, use 0 for numbers
and an empty string for text. Dates are ISO yyyy-mm-dd. Do not merge or drop
lines, even when two lines look identical.`;

function toPart(doc: DocumentInput): Part {
  return doc.kind === "text"
    ? { text: doc.text }
    : { inlineData: { mimeType: doc.mimeType, data: doc.base64 } };
}

export class NotABillError extends Error {}

/** Reads the bill (and the EOB, if given) into the engine's input types. */
export async function extractDocuments(
  billDoc: DocumentInput,
  eobDoc: DocumentInput | null,
  budgetMs: number,
): Promise<{ bill: Bill; eob: Eob | null; model: string }> {
  const parts: Part[] = [{ text: "DOCUMENT 1: the provider's bill." }, toPart(billDoc)];
  if (eobDoc) {
    parts.push({ text: "DOCUMENT 2: the insurer's Explanation of Benefits." }, toPart(eobDoc));
  } else {
    parts.push({ text: "No Explanation of Benefits was provided: return eob as null." });
  }

  const { data, model } = await generateJson({
    system: SYSTEM,
    parts,
    schema: extractionSchema,
    budgetMs,
  });

  if (!data.isMedicalBill || data.bill.lines.length === 0) {
    throw new NotABillError(
      "We could not find an itemized medical bill in that file. Try a clearer photo or the PDF from your patient portal.",
    );
  }
  return { ...normalize(data, Boolean(eobDoc)), model };
}

/** Rounds to cents and fills totals the document left blank. */
function normalize(data: Extraction, eobProvided: boolean): { bill: Bill; eob: Eob | null } {
  const lines = data.bill.lines.map((l) => ({
    ...l,
    code: l.code.trim().toUpperCase(),
    quantity: l.quantity > 0 ? l.quantity : 1,
    charge: cents(Math.abs(l.charge)),
  }));
  const totalCharges = data.bill.totalCharges || sum(lines.map((l) => l.charge));
  const insurancePaid = cents(Math.abs(data.bill.insurancePaid));
  const adjustments = cents(Math.abs(data.bill.adjustments));
  const bill: Bill = {
    ...data.bill,
    lines,
    totalCharges: cents(totalCharges),
    insurancePaid,
    adjustments,
    amountDue: cents(data.bill.amountDue || totalCharges - insurancePaid - adjustments),
  };

  if (!eobProvided || !data.eob || data.eob.lines.length === 0) return { bill, eob: null };

  const eobLines = data.eob.lines.map((l) => ({
    ...l,
    code: l.code.trim().toUpperCase(),
    billed: cents(l.billed),
    allowed: cents(l.allowed),
    insurerPaid: cents(Math.abs(l.insurerPaid)),
    patientResponsibility: cents(l.patientResponsibility),
  }));
  const eob: Eob = {
    ...data.eob,
    lines: eobLines,
    deductibleApplied: cents(data.eob.deductibleApplied),
    coinsuranceApplied: cents(data.eob.coinsuranceApplied),
    totalPatientResponsibility: cents(
      data.eob.totalPatientResponsibility || sum(eobLines.map((l) => l.patientResponsibility)),
    ),
  };
  return { bill, eob };
}
