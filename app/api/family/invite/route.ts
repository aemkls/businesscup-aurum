import { createInvite, familyEnabled } from "@/lib/family";
import { readFamilyCookie } from "@/lib/familyCookies";
import { loyaltySecret } from "@/lib/loyalty";
import { stripe } from "@/lib/payments";

/** POST: a one-time invite link for 7 days. Only the buyer's devices, while a slot is free. */
export async function POST(request: Request) {
  const secret = loyaltySecret();
  if (!familyEnabled() || !secret) {
    return Response.json({ error: "The family plan is not available." }, { status: 404 });
  }
  try {
    const result = await createInvite(stripe(), await readFamilyCookie(), secret);
    if (!result.ok) return Response.json({ error: result.error, code: result.code }, { status: result.status });
    const url = `${new URL(request.url).origin}/family/join?t=${encodeURIComponent(result.token)}`;
    return Response.json({ url, devices: result.devices });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not make an invite link. Please try again." }, { status: 502 });
  }
}
