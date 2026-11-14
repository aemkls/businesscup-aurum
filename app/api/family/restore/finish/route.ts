import { familyEnabled, restoreFamily } from "@/lib/family";
import { writeFamilyCookie } from "@/lib/familyCookies";
import { loyaltySecret } from "@/lib/loyalty";
import { stripe } from "@/lib/payments";

/**
 * POST { setupSessionId }: back from the card check. Finds an active family
 * plan paid with this card and puts it on this browser, without using a
 * device slot. Not found: { retry: true }, since Stripe search can take a
 * minute to see a plan bought just now.
 */
export async function POST(request: Request) {
  const secret = loyaltySecret();
  if (!familyEnabled() || !secret) {
    return Response.json({ error: "The family plan is not available." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { setupSessionId?: unknown } | null;
  const id = typeof body?.setupSessionId === "string" ? body.setupSessionId : "";
  if (!id.startsWith("cs_")) return Response.json({ error: "Invalid session." }, { status: 400 });
  try {
    const result = await restoreFamily(stripe(), id, secret);
    if (!result.ok) {
      return Response.json(
        { error: result.error, code: result.code, retry: Boolean(result.retry) },
        { status: result.status },
      );
    }
    if (result.cookie) await writeFamilyCookie(result.cookie);
    return Response.json({ ok: true, devices: result.devices });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not check your card. Please try again.", retry: true }, { status: 502 });
  }
}
