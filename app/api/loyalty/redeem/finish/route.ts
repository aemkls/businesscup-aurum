import { loyaltyEnabled, loyaltySecret, redeemFreeCase } from "@/lib/loyalty";
import { readFreePass, readLoyaltyCookie, writeFreePass, writeLoyaltyCookie } from "@/lib/loyaltyCookies";
import { stripe } from "@/lib/payments";

/**
 * POST { setupSessionId }: back from the $0 card check. Opens the free case
 * only if the signed stamps, the payments in Stripe and the card all match
 * (see redeemFreeCase), then issues a signed free pass for /api/letters.
 */
export async function POST(request: Request) {
  const secret = loyaltySecret();
  if (!loyaltyEnabled() || !secret) {
    return Response.json({ error: "The loyalty card is not available." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { setupSessionId?: unknown } | null;
  const setupSessionId = typeof body?.setupSessionId === "string" ? body.setupSessionId : "";
  if (!setupSessionId.startsWith("cs_")) {
    return Response.json({ error: "Invalid session." }, { status: 400 });
  }

  // A reload of the return page: this card check already opened the free case.
  if ((await readFreePass()) === setupSessionId) return Response.json({ ok: true });

  try {
    const result = await redeemFreeCase(stripe(), await readLoyaltyCookie(), setupSessionId, secret);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    await writeLoyaltyCookie(result.cookie);
    await writeFreePass(result.freePass);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not check your loyalty card. Please try again." }, { status: 502 });
  }
}
