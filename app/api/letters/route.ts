import { aiConfigured } from "@/lib/ai/client";
import { writeLetters } from "@/lib/ai/letters";
import { runEngine, summarize } from "@/lib/engine";
import { templateLetters } from "@/lib/letters/templates";
import { isPaid, paymentsConfigured } from "@/lib/payments";
import { resultSchema } from "@/lib/resultSchema";
import type { AnalysisResult } from "@/lib/types";

export const maxDuration = 60;

/**
 * POST { sessionId, result }: returns the dispute letter, insurer appeal and
 * call script. The paid content is generated only after Stripe confirms the
 * payment, so it is never present in the free response.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown;
    result?: unknown;
  } | null;
  const parsed = resultSchema.safeParse(body?.result);
  if (!parsed.success) return Response.json({ error: "Invalid case data." }, { status: 400 });

  const demo = !paymentsConfigured();
  if (!demo) {
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!sessionId || !(await isPaid(sessionId))) {
      return Response.json({ error: "Payment not found." }, { status: 402 });
    }
  }

  // Recompute the findings from the documents instead of trusting the amounts
  // sent by the browser; keep the explanations the user already saw.
  const input = parsed.data;
  const seen = new Map(input.findings.map((f) => [f.id, f.explanation]));
  const findings = runEngine(input.bill, input.eob, input.plan).map((f) => ({
    ...f,
    explanation: seen.get(f.id) ?? f.explanation,
  }));
  const result: AnalysisResult = { ...input, findings, ...summarize(input.bill, findings) };

  const letters = aiConfigured() ? await writeLetters(result, 40_000) : templateLetters(result);
  return Response.json({ letters, demo });
}
