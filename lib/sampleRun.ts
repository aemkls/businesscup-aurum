import { unstable_cache } from "next/cache";
import { physicalBill, physicalEob, physicalPlan } from "@/data/samples/physical";
import { sampleBill, sampleEob, samplePlan } from "@/data/samples/sample";
import { explainFindings } from "./ai/explain";
import { extractDocuments } from "./ai/extract";
import { billToText, eobToText } from "./documentText";
import { runEngine, summarize } from "./engine";
import type { AnalysisResult, PlanInfo } from "./types";

export type SampleKind = "er" | "physical";

export const SAMPLES = {
  er: { bill: sampleBill, eob: sampleEob, plan: samplePlan },
  physical: { bill: physicalBill, eob: physicalEob, plan: physicalPlan },
} as const;

/**
 * The full pipeline on a sample: the AI reads the sample documents as text,
 * the engine finds the problems, the AI rewords them. Throws if the AI cannot
 * read the documents, so a failed run is never cached.
 */
async function runSample(kind: SampleKind, plan: PlanInfo): Promise<AnalysisResult> {
  const { bill: sourceBill, eob: sourceEob } = SAMPLES[kind];
  const { bill, eob, model } = await extractDocuments(
    { kind: "text", text: billToText(sourceBill) },
    { kind: "text", text: eobToText(sourceEob) },
    30_000,
  );
  const findings = runEngine(bill, eob, plan);
  const explained = await explainFindings(findings, 15_000);
  return {
    plan,
    bill,
    eob,
    findings: explained.findings,
    ...summarize(bill, explained.findings),
    meta: { aiExtraction: true, aiExplanations: explained.aiWritten, model, hasEob: eob !== null },
  };
}

/**
 * The sample documents never change, so a successful AI run is kept in the
 * Next.js data cache, shared by all server instances, for an hour. The first
 * visitor waits for the AI; later demo clicks answer at once and spend no quota.
 */
export const cachedSample = unstable_cache(runSample, ["claimback-sample-v1"], { revalidate: 3600 });
