import Stripe from "stripe";

/**
 * Stripe Checkout, no webhooks and no database: the client comes back with a
 * session id and the server asks Stripe whether that session was paid.
 *
 * If the Stripe keys are not set, the deployment runs in demo mode and the
 * paid content is unlocked without a charge. The UI says so.
 */

export function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

function stripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string);
}

export async function createCheckoutUrl(origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: process.env.STRIPE_PRICE_ID as string, quantity: 1 }],
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
