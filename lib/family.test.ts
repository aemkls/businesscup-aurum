import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import {
  ACTIVATION_GRACE_MS,
  FAMILY_ERRORS,
  INVITE_TTL_MS,
  METADATA_VALUE_LIMIT,
  activateFamily,
  createInvite,
  decodeFamily,
  decodeInvite,
  encodeFamily,
  encodeInvite,
  familyAccess,
  familyStatus,
  joinFamily,
  portalCustomer,
  restoreFamily,
  withUsedInvite,
  type FamilyStripe,
  type FamilyToken,
} from "./family";
import {
  CARD_NOT_CONFIRMED,
  decodeFreePass,
  decodeToken,
  encodeFreePass,
  encodeToken,
  type LoyaltyToken,
} from "./loyalty";

const SECRET = "test-secret-for-family";
const CARD = "fpCardA";
const OTHER_CARD = "fpCardB";
const NOW = new Date("2026-11-15T03:00:00Z");

type Meta = Record<string, string>;
interface FakeSub {
  id: string;
  status: string;
  customer: string;
  metadata: Meta;
  default_payment_method?: { card: { fingerprint: string } } | null;
  latest_invoice?: string | null;
}

/**
 * An in-memory Stripe: checkout sessions, subscriptions and customers.
 * Metadata updates merge keys like the real API. `unindexed` customers are
 * not found by search yet (Stripe indexes metadata within about a minute).
 */
function fakeStripe() {
  const sessions = new Map<string, Record<string, unknown>>();
  const subs = new Map<string, FakeSub>();
  const customers = new Map<string, { id: string; metadata: Meta }>();
  const unindexed = new Set<string>();
  const invoices = new Map<string, Record<string, unknown>>();
  const charges = new Map<string, Record<string, unknown>>();
  const missing = (what: string) => Object.assign(new Error(`No such ${what}`), { code: "resource_missing" });

  const subscriptionView = (sub: FakeSub) => ({ ...sub, metadata: { ...sub.metadata } }) as unknown as Stripe.Subscription;

  const stripe: FamilyStripe = {
    checkout: {
      sessions: {
        retrieve: vi.fn(async (id: string) => {
          const session = sessions.get(id);
          if (!session) throw missing("checkout.session");
          const view: Record<string, unknown> = { ...session };
          if (typeof session.subscription === "string") {
            const sub = subs.get(session.subscription);
            if (sub) view.subscription = subscriptionView(sub);
          }
          return view as unknown as Stripe.Checkout.Session;
        }),
      },
    },
    subscriptions: {
      retrieve: vi.fn(async (id: string) => {
        const sub = subs.get(id);
        if (!sub) throw missing("subscription");
        return subscriptionView(sub);
      }),
      update: vi.fn(async (id: string, params: Stripe.SubscriptionUpdateParams) => {
        const sub = subs.get(id);
        if (!sub) throw missing("subscription");
        Object.assign(sub.metadata, params.metadata as Meta);
        return subscriptionView(sub);
      }),
      list: vi.fn(async (params: Stripe.SubscriptionListParams) => ({
        data: [...subs.values()]
          .filter((s) => s.customer === params.customer)
          .filter((s) => params.status === "all" || s.status === params.status)
          .map(subscriptionView),
      })),
    },
    customers: {
      update: vi.fn(async (id: string, params: Stripe.CustomerUpdateParams) => {
        const customer = customers.get(id);
        if (!customer) throw missing("customer");
        Object.assign(customer.metadata, params.metadata as Meta);
        return customer;
      }),
      search: vi.fn(async (params: Stripe.CustomerSearchParams) => {
        const fp = /metadata\['card_fp'\]:'([^']*)'/.exec(params.query)?.[1];
        return {
          data: [...customers.values()].filter(
            (c) => c.metadata.card_fp === fp && !unindexed.has(c.id),
          ) as unknown as Stripe.Customer[],
        };
      }),
    },
    invoices: {
      retrieve: vi.fn(async (id: string) => {
        const invoice = invoices.get(id);
        if (!invoice) throw missing("invoice");
        return invoice as unknown as Stripe.Invoice;
      }),
    },
    charges: {
      retrieve: vi.fn(async (id: string) => {
        const charge = charges.get(id);
        if (!charge) throw missing("charge");
        return charge as unknown as Stripe.Charge;
      }),
    },
  };

  /** A completed family checkout: Customer, Subscription and the session. */
  function buy(n: number, opts: { status?: string; card?: string | null; family?: boolean } = {}) {
    const customer = `cus_${n}`;
    const sub: FakeSub = {
      id: `sub_${n}`,
      status: opts.status ?? "active",
      customer,
      metadata: opts.family === false ? {} : { family_plan: "1" },
      default_payment_method:
        opts.card === null ? null : { card: { fingerprint: opts.card ?? CARD } },
      latest_invoice: `in_${n}`,
    };
    subs.set(sub.id, sub);
    customers.set(customer, { id: customer, metadata: {} });
    sessions.set(`cs_sub_${n}`, {
      id: `cs_sub_${n}`,
      mode: "subscription",
      status: "complete",
      customer,
      subscription: sub.id,
    });
    return { session: `cs_sub_${n}`, sub, customer: customers.get(customer)! };
  }

  /** A completed $0 setup checkout with this card. */
  function setup(id: string, card: string | null, complete = true) {
    sessions.set(id, {
      id,
      mode: "setup",
      status: complete ? "complete" : "open",
      setup_intent: {
        status: complete ? "succeeded" : "requires_payment_method",
        payment_method: { card: card ? { fingerprint: card } : null },
      },
    });
  }

  return { stripe, sessions, subs, customers, unindexed, invoices, charges, buy, setup };
}

const ownerCookie = (sub: string, now = NOW) =>
  encodeFamily({ purpose: "family", sub, dev: "devOwner", iat: now.getTime(), own: 1 }, SECRET);
const memberCookie = (sub: string, now = NOW) =>
  encodeFamily({ purpose: "family", sub, dev: "devMember", iat: now.getTime() }, SECRET);

async function activated(f: ReturnType<typeof fakeStripe>, n = 1) {
  const bought = f.buy(n);
  const result = await activateFamily(f.stripe, bought.session, undefined, SECRET, NOW);
  if (!result.ok || !result.cookie) throw new Error(`activation failed: ${JSON.stringify(result)}`);
  return { ...bought, cookie: result.cookie };
}

async function invite(f: ReturnType<typeof fakeStripe>, cookie: string, now = NOW) {
  const result = await createInvite(f.stripe, cookie, SECRET, now);
  if (!result.ok) throw new Error(`invite failed: ${JSON.stringify(result)}`);
  return result.token;
}

describe("family tokens: signature and purpose", () => {
  const family: FamilyToken = { purpose: "family", sub: "sub_1", dev: "dev1", iat: NOW.getTime(), own: 1 };
  const loyalty: LoyaltyToken = { v: 1, fp: CARD, stamps: [{ s: "cs_1", pi: "pi_1" }] };

  it("round-trips a family cookie and an invite", () => {
    expect(decodeFamily(encodeFamily(family, SECRET), SECRET, NOW.getTime())).toEqual(family);
    const inv = { purpose: "family-invite" as const, sub: "sub_1", nonce: "abcdefghijklmnop", exp: 1 };
    expect(decodeInvite(encodeInvite(inv, SECRET), SECRET)).toEqual(inv);
  });

  it("rejects a forged or edited family cookie", () => {
    expect(decodeFamily(encodeFamily(family, "attacker-secret"), SECRET, NOW.getTime())).toBeNull();
    const [, sig] = encodeFamily({ ...family, own: undefined }, SECRET).split(".");
    const edited = Buffer.from(JSON.stringify(family)).toString("base64url");
    expect(decodeFamily(`${edited}.${sig}`, SECRET, NOW.getTime())).toBeNull();
    for (const bad of [undefined, null, "", "x", "a.b.c"]) expect(decodeFamily(bad, SECRET)).toBeNull();
  });

  it("a family cookie is not a loyalty token or a free pass, and the other way round", () => {
    const familyValue = encodeFamily(family, SECRET);
    expect(decodeToken(familyValue, SECRET)).toBeNull();
    expect(decodeFreePass(familyValue, SECRET)).toBeNull();
    expect(decodeFamily(encodeToken(loyalty, SECRET), SECRET)).toBeNull();
    expect(decodeFamily(encodeFreePass("cs_setup", SECRET, NOW.getTime()), SECRET)).toBeNull();
    expect(decodeInvite(encodeToken(loyalty, SECRET), SECRET)).toBeNull();
  });

  it("a loyalty-shaped payload with a purpose is not a loyalty token", () => {
    const disguised = encodeFamily({ ...loyalty, purpose: "family" } as unknown as FamilyToken, SECRET);
    expect(decodeToken(disguised, SECRET)).toBeNull();
  });

  it("the purpose decides, even when every other field fits", () => {
    const sign = (payload: object) => encodeFamily(payload as FamilyToken, SECRET);
    const { purpose: _drop, ...noPurpose } = family;
    void _drop;
    expect(decodeFamily(sign(noPurpose), SECRET, NOW.getTime())).toBeNull();
    expect(decodeFamily(sign({ ...family, purpose: "family-invite" }), SECRET, NOW.getTime())).toBeNull();
    expect(decodeFamily(sign({ ...family, purpose: "loyalty" }), SECRET, NOW.getTime())).toBeNull();
    const inv = { purpose: "family-invite", sub: "sub_1", nonce: "abcdefghijklmnop", exp: 1 };
    expect(decodeInvite(sign({ ...inv, purpose: "family" }), SECRET)).toBeNull();
    const { purpose: _p, ...invNoPurpose } = inv;
    void _p;
    expect(decodeInvite(sign(invNoPurpose), SECRET)).toBeNull();
  });

  it("an invite link is not a device cookie, and a device cookie is not an invite", () => {
    const inv = encodeInvite({ purpose: "family-invite", sub: "sub_1", nonce: "abcdefghijklmnop", exp: Date.now() + 1000 }, SECRET);
    expect(decodeFamily(inv, SECRET)).toBeNull();
    expect(decodeInvite(encodeFamily(family, SECRET), SECRET)).toBeNull();
  });

  it("a family cookie older than a year is not accepted", () => {
    const old = encodeFamily({ ...family, iat: NOW.getTime() - 366 * 24 * 60 * 60 * 1000 }, SECRET);
    expect(decodeFamily(old, SECRET, NOW.getTime())).toBeNull();
  });
});

describe("activation after the subscription checkout", () => {
  it("records the card on the Customer and device 1 on the Subscription, and issues the buyer's cookie", async () => {
    const f = fakeStripe();
    const { session, sub, customer } = f.buy(1);
    const result = await activateFamily(f.stripe, session, undefined, SECRET, NOW);
    expect(result).toMatchObject({ ok: true, devices: 1 });
    if (!result.ok || !result.cookie) throw new Error("expected a cookie");
    expect(customer.metadata.card_fp).toBe(CARD);
    expect(sub.metadata).toMatchObject({ family_devices: "1", family_activated_session: session });
    expect(decodeFamily(result.cookie, SECRET, NOW.getTime())).toMatchObject({ purpose: "family", sub: "sub_1", own: 1 });
  });

  it("is idempotent: a reload with the cookie changes nothing", async () => {
    const f = fakeStripe();
    const { session, sub, cookie } = await activated(f);
    const again = await activateFamily(f.stripe, session, cookie, SECRET, NOW);
    expect(again).toEqual({ ok: true, cookie: null, devices: 1, already: true });
    expect(sub.metadata.family_devices).toBe("1");
  });

  it("a reload that lost the first answer gets the cookie again without a second device", async () => {
    const f = fakeStripe();
    const { session, sub } = await activated(f);
    const soon = new Date(NOW.getTime() + 5 * 60 * 1000);
    const again = await activateFamily(f.stripe, session, undefined, SECRET, soon);
    expect(again).toMatchObject({ ok: true, devices: 1, already: true });
    expect(again.ok && again.cookie && decodeFamily(again.cookie, SECRET, soon.getTime())?.own).toBe(1);
    expect(sub.metadata.family_devices).toBe("1");
  });

  it("the same checkout link later, in another browser, opens nothing", async () => {
    const f = fakeStripe();
    const { session, sub } = await activated(f);
    const later = new Date(NOW.getTime() + ACTIVATION_GRACE_MS + 1000);
    expect(await activateFamily(f.stripe, session, undefined, SECRET, later)).toMatchObject({
      ok: false,
      status: 409,
      code: "already_activated",
    });
    expect(sub.metadata.family_devices).toBe("1");
  });

  it("refuses a one-time payment, a setup session, an unknown id and another subscription", async () => {
    const f = fakeStripe();
    f.sessions.set("cs_pay", { id: "cs_pay", mode: "payment", status: "complete", payment_status: "paid" });
    f.setup("cs_setup", CARD);
    const other = f.buy(2, { family: false });
    for (const id of ["cs_pay", "cs_setup", "cs_unknown", other.session]) {
      expect(await activateFamily(f.stripe, id, undefined, SECRET, NOW)).toMatchObject({ ok: false, code: "not_family" });
    }
  });

  it("refuses an incomplete checkout and a subscription that is not active", async () => {
    const f = fakeStripe();
    const open = f.buy(1);
    f.sessions.get(open.session)!.status = "open";
    expect(await activateFamily(f.stripe, open.session, undefined, SECRET, NOW)).toMatchObject({ ok: false, code: "not_complete" });
    const unpaid = f.buy(2, { status: "incomplete" });
    expect(await activateFamily(f.stripe, unpaid.session, undefined, SECRET, NOW)).toMatchObject({ ok: false, code: "inactive" });
  });

  it("falls back to the first invoice's charge for the card fingerprint", async () => {
    const f = fakeStripe();
    const { session, customer } = f.buy(1, { card: null });
    f.invoices.set("in_1", { id: "in_1", payments: { data: [{ payment: { payment_intent: { id: "pi_1", latest_charge: "ch_1" } } }] } });
    f.charges.set("ch_1", { id: "ch_1", payment_method_details: { card: { fingerprint: OTHER_CARD } } });
    expect(await activateFamily(f.stripe, session, undefined, SECRET, NOW)).toMatchObject({ ok: true });
    expect(customer.metadata.card_fp).toBe(OTHER_CARD);
  });
});

describe("access to cases", () => {
  it("opens with an active or trialing family subscription", async () => {
    for (const status of ["active", "trialing"]) {
      const f = fakeStripe();
      const { sub } = f.buy(1, { status });
      const access = await familyAccess(f.stripe, memberCookie(sub.id), SECRET, NOW.getTime());
      expect(access.ok).toBe(true);
    }
  });

  it("closes at once when the subscription is canceled, past due, unpaid or gone", async () => {
    for (const status of ["canceled", "past_due", "unpaid", "incomplete_expired", "paused"]) {
      const f = fakeStripe();
      const { cookie, sub } = await activated(f);
      sub.status = status;
      expect(await familyAccess(f.stripe, cookie, SECRET, NOW.getTime())).toMatchObject({ ok: false, reason: "inactive" });
    }
    const f = fakeStripe();
    expect(await familyAccess(f.stripe, memberCookie("sub_gone"), SECRET, NOW.getTime())).toMatchObject({ ok: false, reason: "inactive" });
  });

  it("asks Stripe on every check, and not at all without a cookie", async () => {
    const f = fakeStripe();
    const { cookie } = await activated(f);
    const retrieve = vi.mocked(f.stripe.subscriptions.retrieve);
    retrieve.mockClear();
    await familyAccess(f.stripe, cookie, SECRET, NOW.getTime());
    await familyAccess(f.stripe, cookie, SECRET, NOW.getTime());
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(await familyAccess(f.stripe, undefined, SECRET)).toEqual({ ok: false, reason: "no_cookie" });
    expect(retrieve).toHaveBeenCalledTimes(2);
  });

  it("does not open with a subscription that is not a family plan", async () => {
    const f = fakeStripe();
    const { sub } = f.buy(1, { family: false });
    expect((await familyAccess(f.stripe, memberCookie(sub.id), SECRET, NOW.getTime())).ok).toBe(false);
  });

  it("reports the status without ids", async () => {
    const f = fakeStripe();
    const { cookie } = await activated(f);
    const status = await familyStatus(f.stripe, cookie, SECRET, NOW.getTime());
    expect(status).toEqual({ active: true, devices: 1, owner: true });
    expect(JSON.stringify(status)).not.toMatch(/sub_|cus_|fp/);
    expect(await familyStatus(f.stripe, undefined, SECRET)).toEqual({ active: false, devices: 0, owner: false });
  });
});

describe("invite links", () => {
  it("adds a device once: a second browser with the same link is refused as already used", async () => {
    const f = fakeStripe();
    const { cookie, sub } = await activated(f);
    const link = await invite(f, cookie);
    const b = await joinFamily(f.stripe, link, undefined, SECRET, NOW);
    expect(b).toMatchObject({ ok: true, devices: 2 });
    expect(b.ok && b.cookie && decodeFamily(b.cookie, SECRET, NOW.getTime())).toMatchObject({ sub: sub.id });
    expect(b.ok && b.cookie && decodeFamily(b.cookie, SECRET, NOW.getTime())?.own).toBeUndefined();
    expect(sub.metadata.family_devices).toBe("2");
    const c = await joinFamily(f.stripe, link, undefined, SECRET, NOW);
    expect(c).toEqual({ ok: false, status: 409, code: "invite_used", error: FAMILY_ERRORS.inviteUsed });
    expect(FAMILY_ERRORS.inviteUsed).toMatch(/already used/);
    expect(sub.metadata.family_devices).toBe("2");
  });

  it("refuses an expired link", async () => {
    const f = fakeStripe();
    const { cookie, sub } = await activated(f);
    const link = await invite(f, cookie);
    const late = new Date(NOW.getTime() + INVITE_TTL_MS + 1);
    expect(await joinFamily(f.stripe, link, undefined, SECRET, late)).toMatchObject({ ok: false, status: 410, code: "invite_expired" });
    expect(sub.metadata.family_devices).toBe("1");
  });

  it("stops at 5 devices", async () => {
    const f = fakeStripe();
    const { cookie, sub } = await activated(f);
    const links = [];
    for (let i = 0; i < 4; i++) links.push(await invite(f, cookie));
    const extra = encodeInvite({ purpose: "family-invite", sub: sub.id, nonce: "extraNonce123456", exp: NOW.getTime() + 1000 }, SECRET);
    for (const link of links) expect(await joinFamily(f.stripe, link, undefined, SECRET, NOW)).toMatchObject({ ok: true });
    expect(sub.metadata.family_devices).toBe("5");
    expect(await joinFamily(f.stripe, extra, undefined, SECRET, NOW)).toMatchObject({ ok: false, code: "device_limit" });
    // And no new links while all 5 are in use.
    expect(await createInvite(f.stripe, cookie, SECRET, NOW)).toMatchObject({ ok: false, code: "device_limit" });
    expect(sub.metadata.family_devices).toBe("5");
  });

  it("refuses when the plan is no longer active", async () => {
    const f = fakeStripe();
    const { cookie, sub } = await activated(f);
    const link = await invite(f, cookie);
    sub.status = "canceled";
    expect(await joinFamily(f.stripe, link, undefined, SECRET, NOW)).toMatchObject({ ok: false, code: "inactive" });
    expect(await createInvite(f.stripe, cookie, SECRET, NOW)).toMatchObject({ ok: false, code: "inactive" });
  });

  it("refuses a forged link and a link for another kind of token", async () => {
    const f = fakeStripe();
    const { cookie, sub } = await activated(f);
    const forged = encodeInvite({ purpose: "family-invite", sub: sub.id, nonce: "forgedNonce12345", exp: NOW.getTime() + 1000 }, "attacker-secret");
    expect(await joinFamily(f.stripe, forged, undefined, SECRET, NOW)).toMatchObject({ ok: false, code: "invite_invalid" });
    // The buyer's own device cookie pasted as a link does not add a device.
    expect(await joinFamily(f.stripe, cookie, undefined, SECRET, NOW)).toMatchObject({ ok: false, code: "invite_invalid" });
  });

  it("a browser already on the plan keeps the link unused", async () => {
    const f = fakeStripe();
    const { cookie, sub } = await activated(f);
    const link = await invite(f, cookie);
    expect(await joinFamily(f.stripe, link, cookie, SECRET, NOW)).toEqual({ ok: true, cookie: null, devices: 1, already: true });
    expect(await joinFamily(f.stripe, link, undefined, SECRET, NOW)).toMatchObject({ ok: true, devices: 2 });
    expect(sub.metadata.family_devices).toBe("2");
  });

  it("only the buyer's devices make links", async () => {
    const f = fakeStripe();
    const { sub } = await activated(f);
    expect(await createInvite(f.stripe, memberCookie(sub.id), SECRET, NOW)).toMatchObject({ ok: false, code: "not_owner" });
    expect(await createInvite(f.stripe, undefined, SECRET, NOW)).toMatchObject({ ok: false, code: "no_plan" });
  });

  it("keeps the last 20 used links within Stripe's 500 characters", () => {
    let used: string[] = [];
    for (let i = 0; i < 30; i++) used = withUsedInvite(used, `nonce${String(i).padStart(11, "0")}`).split(",");
    expect(used).toHaveLength(20);
    expect(used.at(-1)).toBe("nonce00000000029");
    expect(used.join(",").length).toBeLessThanOrEqual(METADATA_VALUE_LIMIT);
    const long = withUsedInvite(Array.from({ length: 19 }, (_, i) => `${"x".repeat(31)}${i}`), "y".repeat(32));
    expect(long.length).toBeLessThanOrEqual(METADATA_VALUE_LIMIT);
    expect(long.endsWith("y".repeat(32))).toBe(true);
  });
});

describe("restoring with the same card", () => {
  it("finds the plan by the card and does not use a device slot", async () => {
    const f = fakeStripe();
    const { sub } = await activated(f);
    f.setup("cs_restore", CARD);
    const result = await restoreFamily(f.stripe, "cs_restore", SECRET, NOW);
    expect(result).toMatchObject({ ok: true, devices: 1 });
    expect(result.ok && result.cookie && decodeFamily(result.cookie, SECRET, NOW.getTime())).toMatchObject({ sub: sub.id, own: 1 });
    expect(sub.metadata.family_devices).toBe("1");
  });

  it("does not find a plan for another card", async () => {
    const f = fakeStripe();
    await activated(f);
    f.setup("cs_restore", OTHER_CARD);
    expect(await restoreFamily(f.stripe, "cs_restore", SECRET, NOW)).toEqual({
      ok: false,
      status: 404,
      code: "not_found",
      error: FAMILY_ERRORS.notFound,
      retry: true,
    });
  });

  it("does not restore a canceled plan", async () => {
    const f = fakeStripe();
    const { sub } = await activated(f);
    sub.status = "canceled";
    f.setup("cs_restore", CARD);
    expect(await restoreFamily(f.stripe, "cs_restore", SECRET, NOW)).toMatchObject({ ok: false, code: "not_found" });
  });

  it("says to try again while Stripe search has not indexed a new plan, then finds it", async () => {
    const f = fakeStripe();
    const { customer } = await activated(f);
    f.unindexed.add(customer.id);
    f.setup("cs_restore", CARD);
    expect(await restoreFamily(f.stripe, "cs_restore", SECRET, NOW)).toMatchObject({ ok: false, code: "not_found", retry: true });
    f.unindexed.delete(customer.id);
    expect(await restoreFamily(f.stripe, "cs_restore", SECRET, NOW)).toMatchObject({ ok: true });
  });

  it("finds the active plan among several customers with the card", async () => {
    const f = fakeStripe();
    const old = await activated(f, 1);
    old.sub.status = "canceled";
    const current = await activated(f, 2);
    f.setup("cs_restore", CARD);
    const result = await restoreFamily(f.stripe, "cs_restore", SECRET, NOW);
    expect(result.ok && result.cookie && decodeFamily(result.cookie, SECRET, NOW.getTime())?.sub).toBe(current.sub.id);
  });

  it("refuses a card check that was not completed, or a session that is not a card check", async () => {
    const f = fakeStripe();
    await activated(f);
    f.setup("cs_open", CARD, false);
    expect(await restoreFamily(f.stripe, "cs_open", SECRET, NOW)).toMatchObject({ ok: false, error: CARD_NOT_CONFIRMED });
    expect(await restoreFamily(f.stripe, "cs_sub_1", SECRET, NOW)).toMatchObject({ ok: false, error: CARD_NOT_CONFIRMED });
    expect(await restoreFamily(f.stripe, "cs_unknown", SECRET, NOW)).toMatchObject({ ok: false, error: CARD_NOT_CONFIRMED });
  });
});

describe("billing portal", () => {
  it("opens for the buyer, also when a renewal failed", async () => {
    const f = fakeStripe();
    const { cookie, sub } = await activated(f);
    expect(await portalCustomer(f.stripe, cookie, SECRET, NOW.getTime())).toEqual({ ok: true, customer: "cus_1" });
    sub.status = "past_due";
    expect(await portalCustomer(f.stripe, cookie, SECRET, NOW.getTime())).toEqual({ ok: true, customer: "cus_1" });
  });

  it("does not open for a family member or without a plan", async () => {
    const f = fakeStripe();
    const { sub } = await activated(f);
    expect(await portalCustomer(f.stripe, memberCookie(sub.id), SECRET, NOW.getTime())).toMatchObject({ ok: false, code: "not_owner" });
    expect(await portalCustomer(f.stripe, undefined, SECRET, NOW.getTime())).toMatchObject({ ok: false, code: "no_plan" });
  });
});

describe("a stamp-shaped ownership claim is not accepted", () => {
  it("an owner flag only comes from a signed family cookie", () => {
    const value = ownerCookie("sub_1");
    expect(decodeFamily(value, SECRET, NOW.getTime())?.own).toBe(1);
    const tampered = `${Buffer.from(JSON.stringify({ purpose: "family", sub: "sub_1", dev: "devMember", iat: NOW.getTime(), own: 1 })).toString("base64url")}.${memberCookie("sub_1").split(".")[1]}`;
    expect(decodeFamily(tampered, SECRET, NOW.getTime())).toBeNull();
  });
});
