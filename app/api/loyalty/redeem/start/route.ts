import { NOT_ENOUGH_STAMPS, STAMPS_FOR_FREE, loyaltyEnabled } from "@/lib/loyalty";
import { readToken } from "@/lib/loyaltyCookies";
import { createLoyaltySetupUrl } from "@/lib/payments";

/**
 * POST: starts the free case. A $0 Stripe Checkout in setup mode where the
 * user enters the card they paid with; nothing is charged.
 */
export async function POST(request: Request) {
  if (!loyaltyEnabled()) {
    return Response.json({ error: "The loyalty card is not available." }, { status: 404 });
  }
  const token = await readToken();
  if (!token || token.stamps.length < STAMPS_FOR_FREE) {
    return Response.json({ error: NOT_ENOUGH_STAMPS }, { status: 400 });
  }
  try {
    const origin = new URL(request.url).origin;
    return Response.json({ url: await createLoyaltySetupUrl(origin) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not start the card check." }, { status: 502 });
  }
}
