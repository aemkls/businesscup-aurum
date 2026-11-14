import { activateFamily, familyEnabled } from "@/lib/family";
import { readFamilyCookie, writeFamilyCookie } from "@/lib/familyCookies";
import { loyaltySecret } from "@/lib/loyalty";
import { stripe } from "@/lib/payments";

/**
 * POST { sessionId }: back from the family plan checkout. Checks it with
 * Stripe and puts the plan on this browser. A reload changes nothing.
 */
export async function POST(request: Request) {
  const secret = loyaltySecret();
  if (!familyEnabled() || !secret) {
    return Response.json({ error: "The family plan is not available." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!sessionId.startsWith("cs_")) return Response.json({ error: "Invalid session." }, { status: 400 });
  try {
    const result = await activateFamily(stripe(), sessionId, await readFamilyCookie(), secret);
    if (!result.ok) return Response.json({ error: result.error, code: result.code }, { status: result.status });
    if (result.cookie) await writeFamilyCookie(result.cookie);
    return Response.json({ ok: true, devices: result.devices, already: Boolean(result.already) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not confirm your family plan. Please try again." }, { status: 502 });
  }
}
