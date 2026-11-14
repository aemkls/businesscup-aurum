import { familyEnabled } from "@/lib/family";
import { createFamilyRestoreUrl } from "@/lib/payments";

/** POST: "I have a family plan". A $0 Stripe card check; nothing is charged. */
export async function POST(request: Request) {
  if (!familyEnabled()) {
    return Response.json({ error: "The family plan is not available." }, { status: 404 });
  }
  try {
    return Response.json({ url: await createFamilyRestoreUrl(new URL(request.url).origin) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not start the card check." }, { status: 502 });
  }
}
