import { physicalBill, physicalEob, physicalPlan } from "@/data/samples/physical";
import { sampleBill, sampleEob, samplePlan } from "@/data/samples/sample";
import { AiUnavailableError, aiConfigured } from "@/lib/ai/client";
import { explainFindings } from "@/lib/ai/explain";
import { extractDocuments, NotABillError, type DocumentInput } from "@/lib/ai/extract";
import { billToText, eobToText } from "@/lib/documentText";
import { runEngine, summarize } from "@/lib/engine";
import { planSchema } from "@/lib/planSchema";
import { cachedSample } from "@/lib/sampleRun";
import type { AnalysisResult, Bill, Eob } from "@/lib/types";

export const maxDuration = 60;

/** Leave a few seconds of the 60 s function limit for the engine and the response. */
const AI_DEADLINE_MS = 52_000;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic", // iPhone photos
  "image/heif",
  "application/pdf",
]);

/** Some browsers send HEIC photos with an empty type; fall back to the extension. */
function mimeTypeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "heic" || ext === "heif" ? `image/${ext}` : "";
}

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Uploaded files are read into memory for the AI call and never stored. */
async function readUpload(value: FormDataEntryValue | null): Promise<DocumentInput | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  const mimeType = mimeTypeOf(value);
  if (!ALLOWED_TYPES.has(mimeType)) throw new Error("Upload a JPG, PNG, HEIC or PDF file.");
  if (value.size > MAX_BYTES) throw new Error("Files must be under 10 MB.");
  const base64 = Buffer.from(await value.arrayBuffer()).toString("base64");
  return { kind: "file", mimeType, base64 };
}

/**
 * POST multipart form: plan (JSON), bill (file), eob (file, optional), sample ("1").
 * Pipeline: AI reads the documents -> rule engine finds the problems ->
 * AI rewords the explanations. Only the engine produces amounts.
 */
export async function POST(request: Request) {
  const started = Date.now();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Invalid form data.");
  }
  // "1" or "er": the ER visit; "physical": the "free" annual physical.
  const sampleKind = String(form.get("sample") ?? "");
  const isSample = ["1", "er", "physical"].includes(sampleKind);
  const sampleCase =
    sampleKind === "physical"
      ? { bill: physicalBill, eob: physicalEob, plan: physicalPlan }
      : { bill: sampleBill, eob: sampleEob, plan: samplePlan };

  let planInput: unknown;
  try {
    planInput = JSON.parse(String(form.get("plan") ?? ""));
  } catch {
    return fail(400, "Plan details are missing.");
  }
  const plan = planSchema.safeParse(isSample && !planInput ? sampleCase.plan : planInput);
  if (!plan.success) return fail(400, "Check the plan numbers and try again.");

  if (isSample) {
    try {
      return Response.json(await cachedSample(sampleKind === "physical" ? "physical" : "er", plan.data));
    } catch (error) {
      if (!(error instanceof AiUnavailableError)) console.error(error);
      // The sample must always work: if the AI cannot read it, use its
      // structured source. The engine still computes every finding.
      const findings = runEngine(sampleCase.bill, sampleCase.eob, plan.data);
      const fallback: AnalysisResult = {
        plan: plan.data,
        bill: sampleCase.bill,
        eob: sampleCase.eob,
        findings,
        ...summarize(sampleCase.bill, findings),
        meta: { aiExtraction: false, aiExplanations: false, model: null, hasEob: true },
      };
      return Response.json(fallback);
    }
  }

  let billDoc: DocumentInput | null;
  let eobDoc: DocumentInput | null;
  try {
    billDoc = isSample
      ? { kind: "text", text: billToText(sampleCase.bill) }
      : await readUpload(form.get("bill"));
    eobDoc = isSample
      ? { kind: "text", text: eobToText(sampleCase.eob) }
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
    bill = sampleCase.bill;
    eob = sampleCase.eob;
    aiExtraction = false;
  }

  const engineFindings = runEngine(bill, eob, plan.data);
  const explained = aiExtraction
    ? await explainFindings(engineFindings, Math.min(20_000, AI_DEADLINE_MS - (Date.now() - started)))
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
