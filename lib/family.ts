import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { CARD_NOT_CONFIRMED, readSetupSession } from "./loyalty";
import { isId, sign, unsign } from "./signed";

/**
 * Family plan: $79 a year, unlimited cases for up to 5 devices.
 *
 * No accounts and no database. The plan lives in Stripe: the Subscription
 * (status, and in its metadata the device count and the used invite links)
 * and its Customer (card fingerprint, for restoring with the same card).
 * Each device holds an httpOnly cookie signed with LOYALTY_SECRET, with
 * purpose "family" inside the signed data. Access is checked with Stripe on
 * every request for letters, so a canceled or unpaid plan closes at once.
 *
 * Every decision here runs on the server. The client only shows the state.
 */

export const FAMILY_COOKIE = "cb_family";
export const FAMILY_MAX_DEVICES = 5;
export const FAMILY_MAX_AGE_S = 365 * 24 * 60 * 60;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * The purchase return page may hand the owner's cookie out again for this
 * long (a reload before the first answer arrived). Later, the same checkout
 * session opens nothing: the owner restores with the card instead.
 */
export const ACTIVATION_GRACE_MS = 60 * 60 * 1000;
export const KEEP_USED_INVITES = 20;
/** Stripe's limit for one metadata value. */
export const METADATA_VALUE_LIMIT = 500;
/** Statuses that open cases. Canceled, past_due, unpaid and the rest do not. */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export const FAMILY_ERRORS = {
  notFamily: "We couldn't find a family plan purchase for this link.",
  notComplete: "Your family plan payment is not complete yet.",
  inactive: "This family plan is no longer active.",
  alreadyActivated:
    "This family plan is already active in another browser. To add this browser, use “I have a family plan” with the same card.",
  noPlan: "This browser is not on a family plan.",
  notOwner: "Only the person who bought the family plan can do this.",
  inviteInvalid: "This invite link is not valid.",
  inviteExpired: "This invite link has expired. Ask for a new one.",
  inviteUsed: "This invite link was already used. Ask for a new one.",
  deviceLimit: "This family plan already has 5 devices.",
  notFound: "We couldn't find an active family plan for this card.",
} as const;

export type FamilyFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  /** The answer may change soon (Stripe search indexes new plans within a minute). */
  retry?: boolean;
};

const fail = (status: number, code: string, error: string, retry = false): FamilyFailure => ({
  ok: false,
  status,
  code,
  error,
  ...(retry ? { retry } : {}),
});

/** The parts of the Stripe client the family plan uses; tests pass a fake. */
export interface FamilyStripe {
  checkout: {
    sessions: {
      retrieve(
        id: string,
        params?: Stripe.Checkout.SessionRetrieveParams,
      ): Promise<Stripe.Checkout.Session>;
    };
  };
  subscriptions: {
    retrieve(id: string, params?: Stripe.SubscriptionRetrieveParams): Promise<Stripe.Subscription>;
    update(id: string, params: Stripe.SubscriptionUpdateParams): Promise<Stripe.Subscription>;
    list(params: Stripe.SubscriptionListParams): Promise<{ data: Stripe.Subscription[] }>;
  };
  customers: {
    update(id: string, params: Stripe.CustomerUpdateParams): Promise<unknown>;
    search(params: Stripe.CustomerSearchParams): Promise<{ data: Stripe.Customer[] }>;
  };
  invoices: {
    retrieve(id: string, params?: Stripe.InvoiceRetrieveParams): Promise<Stripe.Invoice>;
  };
  charges: {
    retrieve(id: string, params?: Stripe.ChargeRetrieveParams): Promise<Stripe.Charge>;
  };
}

export function familyPriceId(): string | null {
  return process.env.STRIPE_FAMILY_PRICE_ID || null;
}

/** Off unless Stripe, the signing secret and the family price are all set. */
export function familyEnabled(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.LOYALTY_SECRET && familyPriceId(),
  );
}

// ---------------------------------------------------------------------------
// Tokens

export interface FamilyToken {
  purpose: "family";
  sub: string;
  /** A random id for this device. */
  dev: string;
  /** Issued at, ms since epoch. */
  iat: number;
  /** 1 on the buyer's devices (purchase or restore with the card): may invite and manage. */
  own?: 1;
}

export interface InviteToken {
  purpose: "family-invite";
  sub: string;
  nonce: string;
  /** Expiry, ms since epoch. */
  exp: number;
}

const NONCE = /^[A-Za-z0-9_-]{8,32}$/;

export const newDeviceId = () => randomBytes(9).toString("base64url");
export const newNonce = () => randomBytes(12).toString("base64url"); // 16 characters

export function encodeFamily(token: FamilyToken, secret: string): string {
  return sign(token, secret);
}

/** A valid family cookie, or null (bad signature, another kind of token, too old). */
export function decodeFamily(
  value: string | undefined | null,
  secret: string,
  now = Date.now(),
): FamilyToken | null {
  const data = unsign(value, secret) as Record<string, unknown> | null;
  if (!data || data.purpose !== "family") return null;
  if (!isId(data.sub) || !data.sub.startsWith("sub_") || !isId(data.dev)) return null;
  if (typeof data.iat !== "number" || now - data.iat > FAMILY_MAX_AGE_S * 1000) return null;
  return {
    purpose: "family",
    sub: data.sub,
    dev: data.dev,
    iat: data.iat,
    ...(data.own === 1 ? { own: 1 as const } : {}),
  };
}

export function encodeInvite(token: InviteToken, secret: string): string {
  return sign(token, secret);
}

/** A correctly signed invite, expired or not (the caller says which). */
export function decodeInvite(value: string | undefined | null, secret: string): InviteToken | null {
  const data = unsign(value, secret) as Record<string, unknown> | null;
  if (!data || data.purpose !== "family-invite") return null;
  if (!isId(data.sub) || !data.sub.startsWith("sub_")) return null;
  if (typeof data.nonce !== "string" || !NONCE.test(data.nonce) || typeof data.exp !== "number") {
    return null;
  }
  return { purpose: "family-invite", sub: data.sub, nonce: data.nonce, exp: data.exp };
}

function deviceCookie(sub: string, secret: string, now: Date, owner: boolean): string {
  return encodeFamily(
    { purpose: "family", sub, dev: newDeviceId(), iat: now.getTime(), ...(owner ? { own: 1 } : {}) },
    secret,
  );
}

// ---------------------------------------------------------------------------
// The subscription in Stripe

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);

const isMissing = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "resource_missing";

/** Set on the subscription when its checkout is created (subscription_data.metadata). */
export const isFamilySubscription = (sub: Stripe.Subscription) => sub.metadata?.family_plan === "1";

export const subscriptionActive = (sub: Stripe.Subscription) =>
  isFamilySubscription(sub) && ACTIVE_STATUSES.has(sub.status);

export function deviceCount(sub: Stripe.Subscription): number {
  const n = Number.parseInt(sub.metadata?.family_devices ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function usedInvites(sub: Stripe.Subscription): string[] {
  return (sub.metadata?.family_used_invites ?? "").split(",").filter(Boolean);
}

/** The used-invite list with one more nonce: the last 20, within Stripe's 500 characters. */
export function withUsedInvite(used: string[], nonce: string): string {
  const list = [...used.filter((n) => n !== nonce), nonce].slice(-KEEP_USED_INVITES);
  while (list.length > 1 && list.join(",").length > METADATA_VALUE_LIMIT) list.shift();
  return list.join(",");
}

async function retrieveSubscription(
  stripe: FamilyStripe,
  id: string,
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(id);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Access

export type FamilyAccess =
  | { ok: true; token: FamilyToken; subscription: Stripe.Subscription }
  | { ok: false; reason: "no_cookie" | "inactive"; token?: FamilyToken };

/**
 * Checks the signed cookie, then asks Stripe for the subscription: only an
 * active or trialing family subscription opens cases. One Stripe call.
 */
export async function familyAccess(
  stripe: FamilyStripe,
  cookie: string | undefined | null,
  secret: string,
  now = Date.now(),
): Promise<FamilyAccess> {
  const token = decodeFamily(cookie, secret, now);
  if (!token) return { ok: false, reason: "no_cookie" };
  const subscription = await retrieveSubscription(stripe, token.sub);
  if (!subscription || !subscriptionActive(subscription)) {
    return { ok: false, reason: "inactive", token };
  }
  return { ok: true, token, subscription };
}

/** What GET /api/family shows: no ids, no fingerprints. */
export async function familyStatus(
  stripe: FamilyStripe,
  cookie: string | undefined | null,
  secret: string,
  now = Date.now(),
): Promise<{ active: boolean; devices: number; owner: boolean }> {
  const access = await familyAccess(stripe, cookie, secret, now);
  if (!access.ok) return { active: false, devices: 0, owner: false };
  return {
    active: true,
    devices: deviceCount(access.subscription),
    owner: access.token.own === 1,
  };
}

// ---------------------------------------------------------------------------
// Purchase

/** The card the subscription was paid with: its default payment method, else the first invoice's charge. */
async function cardFingerprint(
  stripe: FamilyStripe,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const method = typeof sub.default_payment_method === "object" ? sub.default_payment_method : null;
  if (method?.card?.fingerprint) return method.card.fingerprint;

  const invoiceId = idOf(sub.latest_invoice);
  if (!invoiceId) return null;
  const invoice = await stripe.invoices.retrieve(invoiceId, {
    expand: ["payments.data.payment.payment_intent"],
  });
  for (const payment of invoice.payments?.data ?? []) {
    const intent = payment.payment?.payment_intent;
    if (!intent || typeof intent !== "object") continue;
    const charge =
      typeof intent.latest_charge === "object" && intent.latest_charge
        ? intent.latest_charge
        : intent.latest_charge
          ? await stripe.charges.retrieve(intent.latest_charge)
          : null;
    const fingerprint = charge?.payment_method_details?.card?.fingerprint;
    if (fingerprint) return fingerprint;
  }
  return null;
}

export type FamilyGrant = {
  ok: true;
  /** The new cb_family cookie, or null to keep the one this browser has. */
  cookie: string | null;
  devices: number;
  /** Nothing changed: this browser was already on the plan. */
  already?: boolean;
};

/**
 * Back from the subscription checkout: checks it with Stripe, records the
 * card fingerprint on the Customer and device 1 on the Subscription, and
 * issues the buyer's cookie. Reloading the return page changes nothing.
 */
export async function activateFamily(
  stripe: FamilyStripe,
  sessionId: string,
  cookie: string | undefined | null,
  secret: string,
  now = new Date(),
): Promise<FamilyGrant | FamilyFailure> {
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription.default_payment_method"],
    });
  } catch (error) {
    if (isMissing(error)) return fail(400, "not_family", FAMILY_ERRORS.notFamily);
    throw error;
  }
  if (session.mode !== "subscription") return fail(400, "not_family", FAMILY_ERRORS.notFamily);
  if (session.status !== "complete") return fail(402, "not_complete", FAMILY_ERRORS.notComplete);
  const sub = typeof session.subscription === "object" ? session.subscription : null;
  if (!sub || !isFamilySubscription(sub)) return fail(400, "not_family", FAMILY_ERRORS.notFamily);
  if (!ACTIVE_STATUSES.has(sub.status)) return fail(402, "inactive", FAMILY_ERRORS.inactive);

  // This browser already holds the plan: a reload of the return page.
  const current = decodeFamily(cookie, secret, now.getTime());
  if (current?.sub === sub.id) return { ok: true, cookie: null, devices: deviceCount(sub), already: true };

  const activatedWith = sub.metadata?.family_activated_session;
  if (activatedWith) {
    const at = Date.parse(sub.metadata?.family_activated_at ?? "");
    const recent = activatedWith === sessionId && now.getTime() - at <= ACTIVATION_GRACE_MS;
    if (!recent) return fail(409, "already_activated", FAMILY_ERRORS.alreadyActivated);
    // Within the grace period: the buyer's cookie again, the device count unchanged.
    return { ok: true, cookie: deviceCookie(sub.id, secret, now, true), devices: deviceCount(sub), already: true };
  }

  const fingerprint = await cardFingerprint(stripe, sub);
  const customer = idOf(session.customer) ?? idOf(sub.customer);
  if (fingerprint && customer) {
    await stripe.customers.update(customer, { metadata: { card_fp: fingerprint } });
  }
  await stripe.subscriptions.update(sub.id, {
    metadata: {
      family_devices: "1",
      family_activated_session: sessionId,
      family_activated_at: now.toISOString(),
    },
  });
  return { ok: true, cookie: deviceCookie(sub.id, secret, now, true), devices: 1 };
}

// ---------------------------------------------------------------------------
// Invite links

/** A one-time invite link token for 7 days. The buyer's devices only, while a slot is free. */
export async function createInvite(
  stripe: FamilyStripe,
  cookie: string | undefined | null,
  secret: string,
  now = new Date(),
): Promise<{ ok: true; token: string; devices: number } | FamilyFailure> {
  const access = await familyAccess(stripe, cookie, secret, now.getTime());
  if (!access.ok) {
    return access.reason === "no_cookie"
      ? fail(403, "no_plan", FAMILY_ERRORS.noPlan)
      : fail(402, "inactive", FAMILY_ERRORS.inactive);
  }
  if (access.token.own !== 1) return fail(403, "not_owner", FAMILY_ERRORS.notOwner);
  const devices = deviceCount(access.subscription);
  if (devices >= FAMILY_MAX_DEVICES) return fail(409, "device_limit", FAMILY_ERRORS.deviceLimit);
  const token = encodeInvite(
    {
      purpose: "family-invite",
      sub: access.subscription.id,
      nonce: newNonce(),
      exp: now.getTime() + INVITE_TTL_MS,
    },
    secret,
  );
  return { ok: true, token, devices };
}

/**
 * Opens an invite link on a new device: valid signature, not expired, the
 * plan active, the link not used before and a free slot. Then the link is
 * marked used and the device counted, both in the subscription's metadata.
 */
export async function joinFamily(
  stripe: FamilyStripe,
  inviteValue: string | undefined | null,
  cookie: string | undefined | null,
  secret: string,
  now = new Date(),
): Promise<FamilyGrant | FamilyFailure> {
  const invite = decodeInvite(inviteValue, secret);
  if (!invite) return fail(400, "invite_invalid", FAMILY_ERRORS.inviteInvalid);
  if (invite.exp <= now.getTime()) return fail(410, "invite_expired", FAMILY_ERRORS.inviteExpired);

  const sub = await retrieveSubscription(stripe, invite.sub);
  if (!sub || !subscriptionActive(sub)) return fail(402, "inactive", FAMILY_ERRORS.inactive);

  // Already on this plan (e.g. the buyer opening their own link): keep the link for someone else.
  const current = decodeFamily(cookie, secret, now.getTime());
  if (current?.sub === sub.id) return { ok: true, cookie: null, devices: deviceCount(sub), already: true };

  const used = usedInvites(sub);
  if (used.includes(invite.nonce)) return fail(409, "invite_used", FAMILY_ERRORS.inviteUsed);
  const devices = deviceCount(sub);
  if (devices >= FAMILY_MAX_DEVICES) return fail(409, "device_limit", FAMILY_ERRORS.deviceLimit);

  await stripe.subscriptions.update(sub.id, {
    metadata: {
      family_used_invites: withUsedInvite(used, invite.nonce),
      family_devices: String(devices + 1),
    },
  });
  return { ok: true, cookie: deviceCookie(sub.id, secret, now, false), devices: devices + 1 };
}

// ---------------------------------------------------------------------------
// Restore with the same card

/**
 * After a $0 setup checkout: finds the Customer by the card fingerprint
 * (Stripe search on metadata card_fp) and an active family subscription of
 * theirs. The buyer restoring with their own card does not use a device slot.
 */
export async function restoreFamily(
  stripe: FamilyStripe,
  setupSessionId: string,
  secret: string,
  now = new Date(),
): Promise<FamilyGrant | FamilyFailure> {
  let setup: Stripe.Checkout.Session;
  try {
    setup = await stripe.checkout.sessions.retrieve(setupSessionId, {
      expand: ["setup_intent.payment_method"],
    });
  } catch (error) {
    if (isMissing(error)) return fail(400, "card_not_confirmed", CARD_NOT_CONFIRMED);
    throw error;
  }
  const fingerprint = readSetupSession(setup);
  if (!fingerprint || !/^[A-Za-z0-9]{1,64}$/.test(fingerprint)) {
    return fail(400, "card_not_confirmed", CARD_NOT_CONFIRMED);
  }

  const customers = await stripe.customers.search({
    query: `metadata['card_fp']:'${fingerprint}'`,
    limit: 20,
  });
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 });
    const sub = subs.data.find(subscriptionActive);
    if (sub) return { ok: true, cookie: deviceCookie(sub.id, secret, now, true), devices: deviceCount(sub) };
  }
  // Stripe's search can take up to a minute to see a plan bought just now.
  return fail(404, "not_found", FAMILY_ERRORS.notFound, true);
}

// ---------------------------------------------------------------------------
// Managing the subscription

/** The Customer whose billing portal the buyer may open (to cancel or change the card). */
export async function portalCustomer(
  stripe: FamilyStripe,
  cookie: string | undefined | null,
  secret: string,
  now = Date.now(),
): Promise<{ ok: true; customer: string } | FamilyFailure> {
  const token = decodeFamily(cookie, secret, now);
  if (!token) return fail(403, "no_plan", FAMILY_ERRORS.noPlan);
  if (token.own !== 1) return fail(403, "not_owner", FAMILY_ERRORS.notOwner);
  // Any status: a plan whose renewal failed is fixed in the portal.
  const sub = await retrieveSubscription(stripe, token.sub);
  const customer = sub ? idOf(sub.customer) : null;
  if (!sub || !isFamilySubscription(sub) || !customer) {
    return fail(404, "inactive", FAMILY_ERRORS.inactive);
  }
  return { ok: true, customer };
}
