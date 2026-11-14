import { loyaltyEnabled, loyaltySecret, stampFromCheckout } from "@/lib/loyalty";
import { readLoyaltyCookie, writeLoyaltyCookie } from "@/lib/loyaltyCookies";
import { stripe } from "@/lib/payments";

/**
 * POST { sessionId }: after a return from Checkout, stamps the loyalty card
 * if Stripe says the session is paid. The same session never stamps twice.
 */
export async function POST(request: Request) {
  const secret = loyaltySecret();
  if (!loyaltyEnabled() || !secret) return Response.json({ enabled: false });
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!sessionId.startsWith("cs_")) {
    return Response.json({ error: "Invalid session." }, { status: 400 });
  }
  try {
    const result = await stampFromCheckout(stripe(), await readLoyaltyCookie(), sessionId, secret);
    if (!result.ok) return Response.json({ enabled: true, outcome: result.reason });
    await writeLoyaltyCookie(result.cookie);
    return Response.json({ enabled: true, outcome: result.outcome, stamps: result.stamps });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not update your loyalty card." }, { status: 502 });
  }
}
