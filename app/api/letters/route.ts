import { aiConfigured } from "@/lib/ai/client";
import { writeLetters } from "@/lib/ai/letters";
import { caseHash } from "@/lib/caseHash";
import { validHousehold } from "@/lib/engine/assistance";
import { runEngine, summarize } from "@/lib/engine";
import { templateLetters } from "@/lib/letters/templates";
import { familyAccess, familyEnabled } from "@/lib/family";
import { readFamilyCookie } from "@/lib/familyCookies";
import { lettersAccess, type LettersAccess } from "@/lib/lettersAccess";
import { loyaltyEnabled, loyaltySecret } from "@/lib/loyalty";
import { clearFreePass, readFreePass } from "@/lib/loyaltyCookies";
import { paymentsConfigured, stripe, unlockPaidCase } from "@/lib/payments";
import { resultSchema } from "@/lib/resultSchema";
import type { AnalysisResult } from "@/lib/types";

export const maxDuration = 60;

/**
 * POST { sessionId, result }: returns the dispute letter, insurer appeal and
 * call script. The paid content is generated only for an active family plan
 * on this device, after Stripe confirms a payment for this bill (one payment
 * opens one case, see unlockPaidCase), or with a valid free pass from the
 * loyalty card (a signed cookie issued by /api/loyalty/redeem/finish), so it
 * is never in the free response. A payment already used for another bill
 * answers 402 with code "other_case".
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown;
    result?: unknown;
    household?: unknown;
  } | null;
  const parsed = resultSchema.safeParse(body?.result);
  if (!parsed.success) return Response.json({ error: "Invalid case data." }, { status: 400 });

  // Who may open this case: demo mode, then an active family plan on this
  // device, then a $19 payment for this bill, then the loyalty card's free
  // pass (lib/lettersAccess.ts). Demo mode skips the case check.
  const secret = loyaltySecret();
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  let access: LettersAccess;
  try {
    access = await lettersAccess({
      demo: !paymentsConfigured(),
      sessionId,
      family: async () =>
        familyEnabled() &&
        Boolean(secret) &&
        (await familyAccess(stripe(), await readFamilyCookie(), secret as string)).ok,
      paid: (id) => unlockPaidCase(stripe(), id, caseHash(parsed.data)),
      freePass: async () => loyaltyEnabled() && Boolean(await readFreePass()),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not confirm your payment. Please try again." }, { status: 502 });
  }
  if (!access.ok) {
    return Response.json({ error: access.error, code: access.code }, { status: access.status });
  }
  const demo = access.via === "demo";
  const usedFreePass = access.via === "free_pass";

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
