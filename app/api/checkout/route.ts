import { createCheckoutUrl, paymentsConfigured } from "@/lib/payments";

/** Starts a Stripe Checkout session for one case review. */
export async function POST(request: Request) {
  if (!paymentsConfigured()) return Response.json({ demo: true });
  try {
    const origin = new URL(request.url).origin;
    return Response.json({ url: await createCheckoutUrl(origin) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not start the checkout." }, { status: 502 });
  }
}
