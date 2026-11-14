import Stripe from "stripe";

/**
 * Stripe Checkout, no webhooks and no database: the client comes back with a
 * session id and the server asks Stripe whether that session was paid.
 *
 * If STRIPE_SECRET_KEY is not set, the deployment runs in demo mode and the
 * paid content is unlocked without a charge. The UI says so.
 */

/** One bill review: $19.00, charged once. */
export const PRICE_CENTS = 1900;

export function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string);
}

/** A Price from the Stripe dashboard if one is configured, otherwise an inline $19 price. */
function lineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  const price = process.env.STRIPE_PRICE_ID;
  if (price) return { price, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: PRICE_CENTS,
      product_data: {
        name: "ClaimBack: bill dispute kit",
        description: "Dispute letter, insurer appeal and call script for one medical bill.",
      },
    },
  };
}

export async function createCheckoutUrl(origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem()],
    // The product is for US patients: always charge in US dollars, not in
    // the currency Stripe guesses from the visitor's location.
    adaptive_pricing: { enabled: false },
    success_url: `${origin}/results?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/results`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function isPaid(sessionId: string): Promise<boolean> {
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    return session.payment_status === "paid";
  } catch {
    return false;
  }
}

/**
 * The loyalty card's free case: a $0 setup checkout where the user confirms
 * the card they paid with. Nothing is charged; the server compares the card
 * fingerprint with the stamped payments when the user comes back.
 */
export async function createLoyaltySetupUrl(origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "setup",
    // Cards only (this API version's name for payment_method_types).
    allowed_payment_method_types: ["card"],
    currency: "usd",
    success_url: `${origin}/results?loyalty_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/results?tab=letters`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}
