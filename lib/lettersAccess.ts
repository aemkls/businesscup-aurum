import { PAYMENT_NOT_FOUND, type PaidCaseResult } from "./payments";

export type LettersAccess =
  | { ok: true; via: "demo" | "family" | "paid" | "free_pass" }
  | { ok: false; status: 402; code: string; error: string };

/**
 * Who may get the letters for a case, in this order:
 * 1. demo mode (no Stripe key): everyone;
 * 2. an active family plan on this device: any case, no case binding;
 * 3. a paid $19 session, bound to one bill (unlockPaidCase);
 * 4. the loyalty card's one-time free pass;
 * otherwise 402. Each check runs only if the ones before did not open the case.
 */
export async function lettersAccess(checks: {
  demo: boolean;
  sessionId: string;
  family: () => Promise<boolean>;
  paid: (sessionId: string) => Promise<PaidCaseResult>;
  freePass: () => Promise<boolean>;
}): Promise<LettersAccess> {
  if (checks.demo) return { ok: true, via: "demo" };
  if (await checks.family()) return { ok: true, via: "family" };
  let denied = { code: "not_paid", error: PAYMENT_NOT_FOUND };
  if (checks.sessionId) {
    const outcome = await checks.paid(checks.sessionId);
    if (outcome.ok) return { ok: true, via: "paid" };
    denied = { code: outcome.code, error: outcome.error };
  }
  if (await checks.freePass()) return { ok: true, via: "free_pass" };
  return { ok: false, status: 402, ...denied };
}
