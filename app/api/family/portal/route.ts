import { familyEnabled, portalCustomer } from "@/lib/family";
import { readFamilyCookie } from "@/lib/familyCookies";
import { loyaltySecret } from "@/lib/loyalty";
import { createPortalUrl, stripe } from "@/lib/payments";

/** POST: Stripe's billing portal for the plan (cancel, change the card). The buyer's devices only. */
export async function POST(request: Request) {
  const secret = loyaltySecret();
  if (!familyEnabled() || !secret) {
    return Response.json({ error: "The family plan is not available." }, { status: 404 });
  }
  try {
    const result = await portalCustomer(stripe(), await readFamilyCookie(), secret);
    if (!result.ok) return Response.json({ error: result.error, code: result.code }, { status: result.status });
    const url = await createPortalUrl(result.customer, `${new URL(request.url).origin}/results`);
    return Response.json({ url });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not open the subscription page. Please try again." }, { status: 502 });
  }
}
