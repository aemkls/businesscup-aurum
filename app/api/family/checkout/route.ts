import { familyEnabled, familyPriceId } from "@/lib/family";
import { createFamilyCheckoutUrl } from "@/lib/payments";

/** POST: starts the family plan subscription checkout ($79 a year, cards only). */
export async function POST(request: Request) {
  const price = familyPriceId();
  if (!familyEnabled() || !price) {
    return Response.json({ error: "The family plan is not available." }, { status: 404 });
  }
  try {
    const origin = new URL(request.url).origin;
    return Response.json({ url: await createFamilyCheckoutUrl(origin, price) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not start the checkout." }, { status: 502 });
  }
}
