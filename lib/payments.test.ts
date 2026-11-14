import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { OTHER_CASE, PAYMENT_NOT_FOUND, unlockPaidCase } from "./payments";
import type { StripeLike } from "./stripeLike";

const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const NOW = new Date("2026-11-14T12:00:00Z");

/** A fake Stripe with one checkout session; records metadata writes. */
function fakeStripe(session: { paid: boolean; caseHash?: string } | "missing") {
  const updates: { id: string; metadata: Record<string, string> }[] = [];
  const retrieve = vi.fn(async (id: string, params?: Stripe.Checkout.SessionRetrieveParams) => {
    if (session === "missing") throw new Error(`No such checkout.session: ${id}`);
    expect(params?.expand).toEqual(["payment_intent"]);
    return {
      id,
      mode: "payment",
      payment_status: session.paid ? "paid" : "unpaid",
      payment_intent: {
        id: "pi_1",
        metadata: session.caseHash ? { case_hash: session.caseHash } : {},
      },
    } as unknown as Stripe.Checkout.Session;
  });
  const client: StripeLike = {
    checkout: { sessions: { retrieve } },
    paymentIntents: {
      update: vi.fn(async (id: string, params: Stripe.PaymentIntentUpdateParams) => {
        updates.push({ id, metadata: params.metadata as Record<string, string> });
        return {};
      }),
    },
  };
  return { client, updates, retrieve };
}

describe("one payment opens one case", () => {
  it("binds a paid session to the case the first time and opens it", async () => {
    const { client, updates, retrieve } = fakeStripe({ paid: true });
    expect(await unlockPaidCase(client, "cs_1", HASH, NOW)).toEqual({ ok: true, bound: true });
    expect(updates).toEqual([
      { id: "pi_1", metadata: { case_hash: HASH, case_bound_at: NOW.toISOString() } },
    ]);
    expect(retrieve).toHaveBeenCalledTimes(1); // one read, no second request
  });

  it("opens the same case again without writing (reload, reopening from the tracker)", async () => {
    const { client, updates } = fakeStripe({ paid: true, caseHash: HASH });
    expect(await unlockPaidCase(client, "cs_1", HASH, NOW)).toEqual({ ok: true, bound: false });
    expect(updates).toHaveLength(0);
  });

  it("refuses a different bill with 402 other_case", async () => {
    const { client, updates } = fakeStripe({ paid: true, caseHash: HASH });
    expect(await unlockPaidCase(client, "cs_1", OTHER_HASH, NOW)).toEqual({
      ok: false,
      status: 402,
      code: "other_case",
      error: OTHER_CASE,
    });
    expect(OTHER_CASE).toBe("This payment was for a different bill. Each case is $19.");
    expect(updates).toHaveLength(0);
  });

  it("refuses an unpaid session with 402 and binds nothing", async () => {
    const { client, updates } = fakeStripe({ paid: false });
    expect(await unlockPaidCase(client, "cs_1", HASH, NOW)).toEqual({
      ok: false,
      status: 402,
      code: "not_paid",
      error: PAYMENT_NOT_FOUND,
    });
    expect(updates).toHaveLength(0);
  });

  it("refuses an unknown session id with 402", async () => {
    const { client } = fakeStripe("missing");
    expect(await unlockPaidCase(client, "cs_made_up", HASH, NOW)).toMatchObject({
      ok: false,
      status: 402,
      code: "not_paid",
    });
  });
});
