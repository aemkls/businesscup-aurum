import { createHmac, timingSafeEqual } from "node:crypto";
import type Stripe from "stripe";

/**
 * Loyalty card: every 4th case is free.
 *
 * There are no accounts and no database, so the card is split in two:
 * - the stamps live in this browser, in a cookie signed with LOYALTY_SECRET;
 * - the redemption marks live in Stripe, in the metadata of the paid
 *   PaymentIntents themselves.
 * A free case needs both: the signed stamps from this browser and the same
 * card (Stripe card fingerprint) confirmed again in a $0 setup checkout. The
 * test card 4242… has the same fingerprint everywhere, so the card alone is
 * not enough; a copied cookie without the card is useless.
 *
 * Every decision here runs on the server. The client only shows the state.
 */

export const LOYALTY_COOKIE = "cb_loyalty";
export const FREE_PASS_COOKIE = "cb_free_pass";
/** Paid cases needed before one free case. */
export const STAMPS_FOR_FREE = 3;
/** A free pass is for opening one case now, not a coupon to keep. */
export const FREE_PASS_TTL_MS = 24 * 60 * 60 * 1000;
export const LOYALTY_MAX_AGE_S = 365 * 24 * 60 * 60;

export const CARD_MISMATCH =
  "This card doesn't match the card on your loyalty stamps. Use the same card you paid with.";
export const ALREADY_USED = "These stamps were already used for a free case.";
export const NOT_ENOUGH_STAMPS = "Your loyalty card needs 3 stamps before a free case.";
export const CARD_NOT_CONFIRMED = "We couldn't confirm your card. Please try again.";

export interface Stamp {
  /** Checkout session id of the paid case. */
  s: string;
  /** Its PaymentIntent id, where the redemption mark goes. */
  pi: string;
}

export interface LoyaltyToken {
  v: 1;
  /** Card fingerprint all stamps were paid with. */
  fp: string;
  stamps: Stamp[];
}

interface FreePass {
  v: 1;
  /** The setup checkout session that confirmed the card. */
  free: string;
  /** Expiry, ms since epoch. */
  exp: number;
}

/** The parts of the Stripe client the loyalty card uses; tests pass a fake. */
export interface LoyaltyStripe {
  checkout: {
    sessions: {
      retrieve(
        id: string,
        params?: Stripe.Checkout.SessionRetrieveParams,
      ): Promise<Stripe.Checkout.Session>;
    };
  };
  paymentIntents: {
    update(id: string, params: Stripe.PaymentIntentUpdateParams): Promise<unknown>;
  };
}

export function loyaltySecret(): string | null {
  return process.env.LOYALTY_SECRET || null;
}

/** Off without its secret, and off in demo mode (no Stripe key). */
export function loyaltyEnabled(): boolean {
  return Boolean(loyaltySecret()) && Boolean(process.env.STRIPE_SECRET_KEY);
}

// ---------------------------------------------------------------------------
// Signed values: base64url(JSON) + "." + base64url(HMAC-SHA256(JSON))

function mac(json: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(json).digest();
}

export function sign(payload: object, secret: string): string {
  const json = JSON.stringify(payload);
  return `${Buffer.from(json).toString("base64url")}.${mac(json, secret).toString("base64url")}`;
}

/** The payload if the signature is right, otherwise null. */
export function unsign(value: string | undefined | null, secret: string): unknown {
  if (!value || !secret) return null;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot !== value.lastIndexOf(".")) return null;
  const json = Buffer.from(value.slice(0, dot), "base64url").toString("utf8");
  const given = Buffer.from(value.slice(dot + 1), "base64url");
  const expected = mac(json, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 256;

export function encodeToken(token: LoyaltyToken, secret: string): string {
  return sign(token, secret);
}

export function decodeToken(value: string | undefined | null, secret: string): LoyaltyToken | null {
  const data = unsign(value, secret) as Partial<LoyaltyToken> | null;
  if (!data || data.v !== 1 || !isId(data.fp) || !Array.isArray(data.stamps)) return null;
  if (data.stamps.length > STAMPS_FOR_FREE) return null;
  if (!data.stamps.every((st) => st && isId(st.s) && isId(st.pi))) return null;
  return { v: 1, fp: data.fp, stamps: data.stamps.map(({ s, pi }) => ({ s, pi })) };
}

export function encodeFreePass(setupSessionId: string, secret: string, now = Date.now()): string {
  const pass: FreePass = { v: 1, free: setupSessionId, exp: now + FREE_PASS_TTL_MS };
  return sign(pass, secret);
}

/** The setup session id inside a valid, unexpired free pass, otherwise null. */
export function decodeFreePass(
  value: string | undefined | null,
  secret: string,
  now = Date.now(),
): string | null {
  const data = unsign(value, secret) as Partial<FreePass> | null;
  if (!data || data.v !== 1 || !isId(data.free) || typeof data.exp !== "number") return null;
  return data.exp > now ? data.free : null;
}

/** What the UI may show. Read from the signed cookie only. */
export function loyaltyState(token: LoyaltyToken | null): { stamps: number; freeAvailable: boolean } {
  const stamps = Math.min(token?.stamps.length ?? 0, STAMPS_FOR_FREE);
  return { stamps, freeAvailable: stamps >= STAMPS_FOR_FREE };
}

// ---------------------------------------------------------------------------
// Stamps

export interface PaidCase {
  sessionId: string;
  paymentIntentId: string;
  fingerprint: string;
}

export type StampOutcome = "added" | "restarted" | "duplicate" | "full";

/**
 * Adds one paid case to the card. One session gives one stamp; a payment
 * with another card starts the card again, so stamps from different cards
 * never add up. A full card (3 stamps) waits for its free case.
 */
export function addStamp(
  token: LoyaltyToken | null,
  paid: PaidCase,
): { token: LoyaltyToken; outcome: StampOutcome } {
  const stamp = { s: paid.sessionId, pi: paid.paymentIntentId };
  if (!token || token.fp !== paid.fingerprint) {
    return {
      token: { v: 1, fp: paid.fingerprint, stamps: [stamp] },
      outcome: token && token.stamps.length > 0 ? "restarted" : "added",
    };
  }
  if (token.stamps.some((st) => st.s === paid.sessionId)) return { token, outcome: "duplicate" };
  if (token.stamps.length >= STAMPS_FOR_FREE) return { token, outcome: "full" };
  return { token: { ...token, stamps: [...token.stamps, stamp] }, outcome: "added" };
}

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);

interface StripeStampInfo {
  paid: boolean;
  paymentIntentId: string | null;
  fingerprint: string | null;
  redeemed: boolean;
}

/** Reads a payment checkout session retrieved with expand payment_intent.latest_charge. */
export function readPaidSession(session: Stripe.Checkout.Session): StripeStampInfo {
  const pi = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = pi && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  return {
    paid: session.mode === "payment" && session.payment_status === "paid",
    paymentIntentId: idOf(session.payment_intent),
    fingerprint: charge?.payment_method_details?.card?.fingerprint ?? null,
    redeemed: pi?.metadata?.loyalty_redeemed === "true",
  };
}

async function retrievePaid(stripe: LoyaltyStripe, sessionId: string): Promise<StripeStampInfo> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.latest_charge"],
  });
  return readPaidSession(session);
}

/**
 * After a return from Checkout: checks with Stripe that the session is paid,
 * reads the card fingerprint and stamps the card.
 */
export async function stampFromCheckout(
  stripe: LoyaltyStripe,
  cookie: string | undefined | null,
  sessionId: string,
  secret: string,
): Promise<
  | { ok: true; cookie: string; outcome: StampOutcome; stamps: number }
  | { ok: false; reason: "unpaid" | "no-card" }
> {
  const info = await retrievePaid(stripe, sessionId);
  if (!info.paid || !info.paymentIntentId) return { ok: false, reason: "unpaid" };
  // Paid without a card fingerprint (e.g. another payment method): no stamp.
  if (!info.fingerprint) return { ok: false, reason: "no-card" };
  const { token, outcome } = addStamp(decodeToken(cookie, secret), {
    sessionId,
    paymentIntentId: info.paymentIntentId,
    fingerprint: info.fingerprint,
  });
  return { ok: true, cookie: encodeToken(token, secret), outcome, stamps: token.stamps.length };
}

// ---------------------------------------------------------------------------
// Redemption

/** Reads a setup checkout session retrieved with expand setup_intent.payment_method. */
export function readSetupSession(session: Stripe.Checkout.Session): string | null {
  if (session.mode !== "setup" || session.status !== "complete") return null;
  const intent = typeof session.setup_intent === "object" ? session.setup_intent : null;
  if (!intent || intent.status !== "succeeded") return null;
  const method = typeof intent.payment_method === "object" ? intent.payment_method : null;
  return method?.card?.fingerprint ?? null;
}

export type RedeemResult =
  | { ok: true; cookie: string; freePass: string }
  | { ok: false; status: number; error: string };

/**
 * Opens one free case, only if everything checks out: a valid signed card
 * with 3 stamps, each a paid Checkout session, none redeemed before, all
 * paid with the card just confirmed in the setup checkout. Then marks the 3
 * PaymentIntents as redeemed in Stripe, empties the card and issues a
 * signed free pass.
 */
export async function redeemFreeCase(
  stripe: LoyaltyStripe,
  cookie: string | undefined | null,
  setupSessionId: string,
  secret: string,
  now = new Date(),
): Promise<RedeemResult> {
  const token = decodeToken(cookie, secret);
  if (!token || token.stamps.length < STAMPS_FOR_FREE) {
    return { ok: false, status: 400, error: NOT_ENOUGH_STAMPS };
  }

  const setup = await stripe.checkout.sessions.retrieve(setupSessionId, {
    expand: ["setup_intent.payment_method"],
  });
  const fingerprint = readSetupSession(setup);
  if (!fingerprint) return { ok: false, status: 400, error: CARD_NOT_CONFIRMED };

  const stamps = token.stamps.slice(0, STAMPS_FOR_FREE);
  const infos = await Promise.all(stamps.map((st) => retrievePaid(stripe, st.s)));
  for (const [i, info] of infos.entries()) {
    if (!info.paid || info.paymentIntentId !== stamps[i].pi) {
      return { ok: false, status: 400, error: NOT_ENOUGH_STAMPS };
    }
  }
  if (infos.some((info) => info.redeemed)) return { ok: false, status: 409, error: ALREADY_USED };
  if (infos.some((info) => info.fingerprint !== fingerprint)) {
    return { ok: false, status: 400, error: CARD_MISMATCH };
  }

  const at = now.toISOString();
  await Promise.all(
    stamps.map((st) =>
      stripe.paymentIntents.update(st.pi, {
        metadata: {
          loyalty_redeemed: "true",
          loyalty_redeemed_at: at,
          loyalty_setup_session: setupSessionId,
        },
      }),
    ),
  );

  return {
    ok: true,
    cookie: encodeToken({ v: 1, fp: token.fp, stamps: [] }, secret),
    freePass: encodeFreePass(setupSessionId, secret, now.getTime()),
  };
}
