import { aiConfigured } from "@/lib/ai/client";
import { writeLetters } from "@/lib/ai/letters";
import { caseHash } from "@/lib/caseHash";
import { validHousehold } from "@/lib/engine/assistance";
import { runEngine, summarize } from "@/lib/engine";
import { templateLetters } from "@/lib/letters/templates";
import { loyaltyEnabled } from "@/lib/loyalty";
import { clearFreePass, readFreePass } from "@/lib/loyaltyCookies";
import { PAYMENT_NOT_FOUND, paymentsConfigured, stripe, unlockPaidCase } from "@/lib/payments";
import { resultSchema } from "@/lib/resultSchema";
import type { AnalysisResult } from "@/lib/types";

export const maxDuration = 60;

/**
 * POST { sessionId, result }: returns the dispute letter, insurer appeal and
 * call script. The paid content is generated only after Stripe confirms the
 * payment for this bill (one payment opens one case, see unlockPaidCase), or
 * with a valid free pass from the loyalty card (a signed cookie issued by
 * /api/loyalty/redeem/finish), so it is never in the free response. A
 * payment already used for another bill answers 402 with code "other_case".
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown;
    result?: unknown;
    household?: unknown;
  } | null;
  const parsed = resultSchema.safeParse(body?.result);
  if (!parsed.success) return Response.json({ error: "Invalid case data." }, { status: 400 });

  // Demo mode (no Stripe key): unlocked without a charge and without the case check.
  const demo = !paymentsConfigured();
  let usedFreePass = false;
  if (!demo) {
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    let denied: { error: string; code: string } = { error: PAYMENT_NOT_FOUND, code: "not_paid" };
    let paid = false;
    if (sessionId) {
      try {
        // One payment = one case: the bill's hash is bound to the payment in Stripe.
        const outcome = await unlockPaidCase(stripe(), sessionId, caseHash(parsed.data));
        if (outcome.ok) paid = true;
        else denied = { error: outcome.error, code: outcome.code };
      } catch (error) {
        console.error(error);
        return Response.json({ error: "Could not confirm your payment. Please try again." }, { status: 502 });
      }
    }
    if (!paid) {
      // The loyalty card's free case: a signed one-time pass (unchanged).
      usedFreePass = loyaltyEnabled() && Boolean(await readFreePass());
      if (!usedFreePass) return Response.json(denied, { status: 402 });
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

  const household = validHousehold(body?.household) ? body.household : null;
  const letters = aiConfigured()
    ? await writeLetters(result, household, 40_000)
    : templateLetters(result, household);
  // A free pass opens one case.
  if (usedFreePass) await clearFreePass();
  return Response.json({ letters, demo });
}
