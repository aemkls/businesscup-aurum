import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  ALREADY_USED,
  CARD_MISMATCH,
  CARD_NOT_CONFIRMED,
  NOT_ENOUGH_STAMPS,
  addStamp,
  decodeFreePass,
  decodeToken,
  encodeFreePass,
  encodeToken,
  loyaltyState,
  redeemFreeCase,
  stampFromCheckout,
  type LoyaltyStripe,
  type LoyaltyToken,
} from "./loyalty";

const SECRET = "test-secret-for-loyalty";
const CARD = "fp_card_A";
const OTHER_CARD = "fp_card_B";

/** A fake of the bits of Stripe the loyalty card calls. */
function fakeStripe(opts: {
  paid?: Record<string, PaidFake>;
  setup?: Record<string, { fp: string | null; incomplete?: boolean }>;
}) {
  const updates: { id: string; metadata: Record<string, string> }[] = [];
  const stripe: LoyaltyStripe = {
    checkout: {
      sessions: {
        retrieve: vi.fn(async (id: string) => {
          const paid = opts.paid?.[id];
          if (paid) {
            return {
              id,
              mode: "payment",
              payment_status: paid.unpaid ? "unpaid" : "paid",
              payment_intent: {
                id: paid.pi,
                metadata: paid.redeemed ? { loyalty_redeemed: "true" } : {},
                latest_charge: {
                  payment_method_details: { card: paid.fp ? { fingerprint: paid.fp } : null },
                },
              },
            } as unknown as Stripe.Checkout.Session;
          }
          const setup = opts.setup?.[id];
          if (setup) {
            return {
              id,
              mode: "setup",
              status: setup.incomplete ? "open" : "complete",
              setup_intent: {
                status: setup.incomplete ? "requires_payment_method" : "succeeded",
                payment_method: { card: setup.fp ? { fingerprint: setup.fp } : null },
              },
            } as unknown as Stripe.Checkout.Session;
          }
          throw new Error(`No such checkout.session: ${id}`);
        }),
      },
    },
    paymentIntents: {
      update: vi.fn(async (id: string, params: Stripe.PaymentIntentUpdateParams) => {
        updates.push({ id, metadata: params.metadata as Record<string, string> });
        return {};
      }),
    },
  };
  return { stripe, updates };
}

const threeStamps: LoyaltyToken = {
  v: 1,
  fp: CARD,
  stamps: [
    { s: "cs_1", pi: "pi_1" },
    { s: "cs_2", pi: "pi_2" },
    { s: "cs_3", pi: "pi_3" },
  ],
};

type PaidFake = { pi: string; fp: string | null; redeemed?: boolean; unpaid?: boolean };
const paidThree = (fp = CARD, redeemed = false): Record<string, PaidFake> => ({
  cs_1: { pi: "pi_1", fp, redeemed },
  cs_2: { pi: "pi_2", fp },
  cs_3: { pi: "pi_3", fp },
});

describe("signed loyalty token", () => {
  it("round-trips a signed token", () => {
    expect(decodeToken(encodeToken(threeStamps, SECRET), SECRET)).toEqual(threeStamps);
  });

  it("rejects a forged signature", () => {
    const value = encodeToken(threeStamps, SECRET);
    const [payload] = value.split(".");
    const forgedSig = `${payload}.${"A".repeat(43)}`;
    expect(decodeToken(forgedSig, SECRET)).toBeNull();
    // Another secret signs a token the server does not accept.
    expect(decodeToken(encodeToken(threeStamps, "attacker-secret"), SECRET)).toBeNull();
  });

  it("rejects a payload edited after signing", () => {
    const value = encodeToken({ ...threeStamps, stamps: threeStamps.stamps.slice(0, 1) }, SECRET);
    const [, sig] = value.split(".");
    const edited = Buffer.from(JSON.stringify(threeStamps)).toString("base64url");
    expect(decodeToken(`${edited}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects garbage and missing values", () => {
    for (const bad of [undefined, null, "", "abc", "a.b.c", "....", "%%%.%%%"]) {
      expect(decodeToken(bad, SECRET)).toBeNull();
    }
  });

  it("does not accept a free pass as a loyalty token, or the other way round", () => {
    const pass = encodeFreePass("cs_setup", SECRET);
    expect(decodeToken(pass, SECRET)).toBeNull();
    expect(decodeFreePass(encodeToken(threeStamps, SECRET), SECRET)).toBeNull();
  });

  it("reports the UI state from the token", () => {
    expect(loyaltyState(null)).toEqual({ stamps: 0, freeAvailable: false });
    expect(loyaltyState({ ...threeStamps, stamps: threeStamps.stamps.slice(0, 2) })).toEqual({
      stamps: 2,
      freeAvailable: false,
    });
    expect(loyaltyState(threeStamps)).toEqual({ stamps: 3, freeAvailable: true });
  });
});

describe("adding stamps", () => {
  const paid = (n: number, fp = CARD) => ({ sessionId: `cs_${n}`, paymentIntentId: `pi_${n}`, fingerprint: fp });

  it("starts a card with the first payment", () => {
    const { token, outcome } = addStamp(null, paid(1));
    expect(outcome).toBe("added");
    expect(token).toEqual({ v: 1, fp: CARD, stamps: [{ s: "cs_1", pi: "pi_1" }] });
  });

  it("gives one stamp per session id, however often it comes back", () => {
    let { token } = addStamp(null, paid(1));
    const again = addStamp(token, paid(1));
    expect(again.outcome).toBe("duplicate");
    expect(again.token.stamps).toHaveLength(1);
    token = addStamp(token, paid(2)).token;
    expect(addStamp(token, paid(1)).token.stamps).toHaveLength(2);
  });

  it("starts again when another card pays: stamps from different cards don't add up", () => {
    let { token } = addStamp(null, paid(1));
    token = addStamp(token, paid(2)).token;
    const other = addStamp(token, paid(3, OTHER_CARD));
    expect(other.outcome).toBe("restarted");
    expect(other.token).toEqual({ v: 1, fp: OTHER_CARD, stamps: [{ s: "cs_3", pi: "pi_3" }] });
  });

  it("stops at 3 stamps until the free case is used", () => {
    const full = addStamp(threeStamps, paid(4));
    expect(full.outcome).toBe("full");
    expect(full.token.stamps).toHaveLength(3);
  });

  it("stamps from Stripe only when the session is paid and has a card fingerprint", async () => {
    const { stripe } = fakeStripe({
      paid: {
        cs_1: { pi: "pi_1", fp: CARD },
        cs_unpaid: { pi: "pi_x", fp: CARD, unpaid: true },
        cs_wallet: { pi: "pi_w", fp: null },
      },
    });
    const first = await stampFromCheckout(stripe, undefined, "cs_1", SECRET);
    expect(first).toMatchObject({ ok: true, outcome: "added", stamps: 1 });
    if (!first.ok) throw new Error("expected a stamp");
    expect(decodeToken(first.cookie, SECRET)?.stamps).toEqual([{ s: "cs_1", pi: "pi_1" }]);

    const repeat = await stampFromCheckout(stripe, first.cookie, "cs_1", SECRET);
    expect(repeat).toMatchObject({ ok: true, outcome: "duplicate", stamps: 1 });

    expect(await stampFromCheckout(stripe, first.cookie, "cs_unpaid", SECRET)).toEqual({
      ok: false,
      reason: "unpaid",
    });
    expect(await stampFromCheckout(stripe, first.cookie, "cs_wallet", SECRET)).toEqual({
      ok: false,
      reason: "no-card",
    });
  });

  it("a family plan subscription gives no stamp", async () => {
    const stripe: LoyaltyStripe = {
      checkout: {
        sessions: {
          retrieve: vi.fn(async (id: string) =>
            ({
              id,
              mode: "subscription",
              payment_status: "paid",
              status: "complete",
              payment_intent: null,
              subscription: "sub_1",
            }) as unknown as Stripe.Checkout.Session,
          ),
        },
      },
      paymentIntents: { update: vi.fn(async () => ({})) },
    };
    expect(await stampFromCheckout(stripe, undefined, "cs_family", SECRET)).toEqual({ ok: false, reason: "unpaid" });
  });

  it("ignores a forged cookie and starts a fresh card", async () => {
    const { stripe } = fakeStripe({ paid: { cs_9: { pi: "pi_9", fp: CARD } } });
    const forged = `${Buffer.from(JSON.stringify(threeStamps)).toString("base64url")}.forged`;
    const result = await stampFromCheckout(stripe, forged, "cs_9", SECRET);
    expect(result).toMatchObject({ ok: true, stamps: 1 });
  });
});

describe("redeeming the free case", () => {
  const NOW = new Date("2026-11-14T10:00:00Z");

  it("3 paid stamps and the same card: marks the payments, empties the card, issues a pass", async () => {
    const { stripe, updates } = fakeStripe({
      paid: paidThree(),
      setup: { cs_setup: { fp: CARD } },
    });
    const result = await redeemFreeCase(stripe, encodeToken(threeStamps, SECRET), "cs_setup", SECRET, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    expect(updates.map((u) => u.id).sort()).toEqual(["pi_1", "pi_2", "pi_3"]);
    for (const u of updates) {
      expect(u.metadata).toMatchObject({
        loyalty_redeemed: "true",
        loyalty_redeemed_at: NOW.toISOString(),
      });
    }
    expect(decodeToken(result.cookie, SECRET)?.stamps).toEqual([]);
    expect(decodeFreePass(result.freePass, SECRET, NOW.getTime())).toBe("cs_setup");
  });

  it("refuses another card", async () => {
    const { stripe, updates } = fakeStripe({
      paid: paidThree(),
      setup: { cs_setup: { fp: OTHER_CARD } },
    });
    const result = await redeemFreeCase(stripe, encodeToken(threeStamps, SECRET), "cs_setup", SECRET, NOW);
    expect(result).toEqual({ ok: false, status: 400, error: CARD_MISMATCH });
    expect(updates).toHaveLength(0);
  });

  it("refuses stamps already used for a free case", async () => {
    const { stripe, updates } = fakeStripe({
      paid: paidThree(CARD, true),
      setup: { cs_setup: { fp: CARD } },
    });
    const result = await redeemFreeCase(stripe, encodeToken(threeStamps, SECRET), "cs_setup", SECRET, NOW);
    expect(result).toEqual({ ok: false, status: 409, error: ALREADY_USED });
    expect(updates).toHaveLength(0);
  });

  it("refuses the same stamps twice (a copy of the old cookie)", async () => {
    const paid = paidThree();
    const { stripe } = fakeStripe({ paid, setup: { cs_setup: { fp: CARD }, cs_setup2: { fp: CARD } } });
    const oldCookie = encodeToken(threeStamps, SECRET);
    const first = await redeemFreeCase(stripe, oldCookie, "cs_setup", SECRET, NOW);
    expect(first.ok).toBe(true);
    // Stripe now holds the redemption mark on the payments.
    for (const fake of Object.values(paid)) fake.redeemed = true;
    const second = await redeemFreeCase(stripe, oldCookie, "cs_setup2", SECRET, NOW);
    expect(second).toEqual({ ok: false, status: 409, error: ALREADY_USED });
  });

  it("refuses a forged cookie", async () => {
    const { stripe, updates } = fakeStripe({ paid: paidThree(), setup: { cs_setup: { fp: CARD } } });
    const forged = encodeToken(threeStamps, "attacker-secret");
    const result = await redeemFreeCase(stripe, forged, "cs_setup", SECRET, NOW);
    expect(result).toEqual({ ok: false, status: 400, error: NOT_ENOUGH_STAMPS });
    expect(updates).toHaveLength(0);
  });

  it("refuses fewer than 3 stamps", async () => {
    const { stripe } = fakeStripe({ paid: paidThree(), setup: { cs_setup: { fp: CARD } } });
    const two = encodeToken({ ...threeStamps, stamps: threeStamps.stamps.slice(0, 2) }, SECRET);
    expect(await redeemFreeCase(stripe, two, "cs_setup", SECRET, NOW)).toEqual({
      ok: false,
      status: 400,
      error: NOT_ENOUGH_STAMPS,
    });
  });

  it("refuses a stamp whose session is not paid in Stripe", async () => {
    const paid = { ...paidThree(), cs_2: { pi: "pi_2", fp: CARD, unpaid: true } };
    const { stripe, updates } = fakeStripe({ paid, setup: { cs_setup: { fp: CARD } } });
    const result = await redeemFreeCase(stripe, encodeToken(threeStamps, SECRET), "cs_setup", SECRET, NOW);
    expect(result.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("refuses a setup checkout that was not completed", async () => {
    const { stripe } = fakeStripe({ paid: paidThree(), setup: { cs_setup: { fp: CARD, incomplete: true } } });
    const result = await redeemFreeCase(stripe, encodeToken(threeStamps, SECRET), "cs_setup", SECRET, NOW);
    expect(result).toEqual({ ok: false, status: 400, error: CARD_NOT_CONFIRMED });
  });

  it("does not accept a paid session id in place of the setup session", async () => {
    const { stripe } = fakeStripe({ paid: paidThree() });
    const result = await redeemFreeCase(stripe, encodeToken(threeStamps, SECRET), "cs_1", SECRET, NOW);
    expect(result).toEqual({ ok: false, status: 400, error: CARD_NOT_CONFIRMED });
  });
});

describe("free pass", () => {
  it("is valid for a day and then expires", () => {
    const now = Date.parse("2026-11-14T10:00:00Z");
    const pass = encodeFreePass("cs_setup", SECRET, now);
    expect(decodeFreePass(pass, SECRET, now + 60_000)).toBe("cs_setup");
    expect(decodeFreePass(pass, SECRET, now + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("rejects a forged pass", () => {
    const now = Date.now();
    expect(decodeFreePass(encodeFreePass("cs_setup", "attacker-secret", now), SECRET, now)).toBeNull();
    expect(decodeFreePass("eyJ2IjoxfQ.bad", SECRET, now)).toBeNull();
  });
});
