import { sampleBill, sampleEob, samplePlan } from "@/data/samples/sample";
import { AiUnavailableError, aiConfigured } from "@/lib/ai/client";
import { explainFindings } from "@/lib/ai/explain";
import { extractDocuments, NotABillError, type DocumentInput } from "@/lib/ai/extract";
import { billToText, eobToText } from "@/lib/documentText";
import { runEngine, summarize } from "@/lib/engine";
import { planSchema } from "@/lib/planSchema";
import type { AnalysisResult, Bill, Eob } from "@/lib/types";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Uploaded files are read into memory for the AI call and never stored. */
async function readUpload(value: FormDataEntryValue | null): Promise<DocumentInput | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (!ALLOWED_TYPES.has(value.type)) throw new Error("Upload a JPG, PNG or PDF file.");
  if (value.size > MAX_BYTES) throw new Error("Files must be under 10 MB.");
  const base64 = Buffer.from(await value.arrayBuffer()).toString("base64");
  return { kind: "file", mimeType: value.type, base64 };
}

/**
 * POST multipart form: plan (JSON), bill (file), eob (file, optional), sample ("1").
 * Pipeline: AI reads the documents -> rule engine finds the problems ->
 * AI rewords the explanations. Only the engine produces amounts.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Invalid form data.");
  }
  const isSample = form.get("sample") === "1";

  let planInput: unknown;
  try {
    planInput = JSON.parse(String(form.get("plan") ?? ""));
  } catch {
    return fail(400, "Plan details are missing.");
  }
  const plan = planSchema.safeParse(isSample && !planInput ? samplePlan : planInput);
  if (!plan.success) return fail(400, "Check the plan numbers and try again.");

  let billDoc: DocumentInput | null;
  let eobDoc: DocumentInput | null;
  try {
    billDoc = isSample
      ? { kind: "text", text: billToText(sampleBill) }
      : await readUpload(form.get("bill"));
    eobDoc = isSample
      ? { kind: "text", text: eobToText(sampleEob) }
      : await readUpload(form.get("eob"));
  } catch (error) {
    return fail(400, (error as Error).message);
  }
  if (!billDoc) return fail(400, "Add a photo or PDF of your bill.");

  let bill: Bill;
  let eob: Eob | null;
  let model: string | null = null;
  let aiExtraction = true;
  try {
    const extracted = await extractDocuments(billDoc, eobDoc, 35_000);
    ({ bill, eob, model } = extracted);
  } catch (error) {
    if (error instanceof NotABillError) return fail(422, error.message);
    if (!(error instanceof AiUnavailableError)) console.error(error);
    if (!isSample) {
      return fail(
        503,
        aiConfigured()
          ? "Our document reader is busy right now. Please try again in a minute."
          : "The document reader is not configured on this deployment.",
      );
    }
    // The sample must always work: fall back to its structured source.
    // The engine below still computes every finding from scratch.
    bill = sampleBill;
    eob = sampleEob;
    aiExtraction = false;
  }

  const engineFindings = runEngine(bill, eob, plan.data);
  const explained = aiExtraction
    ? await explainFindings(engineFindings, 15_000)
    : { findings: engineFindings, aiWritten: false };

  const result: AnalysisResult = {
    plan: plan.data,
    bill,
    eob,
    findings: explained.findings,
    ...summarize(bill, explained.findings),
    meta: {
      aiExtraction,
      aiExplanations: explained.aiWritten,
      model,
      hasEob: eob !== null,
    },
  };
  return Response.json(result);
}
