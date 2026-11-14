import { connection } from "next/server";
import { FAMILY_MAX_DEVICES, familyEnabled, familyStatus } from "@/lib/family";
import { readFamilyCookie } from "@/lib/familyCookies";
import { loyaltySecret } from "@/lib/loyalty";
import { stripe } from "@/lib/payments";

const NO_STORE = { headers: { "cache-control": "no-store" } };

/**
 * GET: the family plan as the UI shows it: { enabled, active, devices,
 * maxDevices, owner }. No ids or fingerprints. Asks Stripe only when this
 * browser has a family cookie.
 */
export async function GET() {
  await connection(); // per request: never prerendered with the build's env
  const off = { enabled: false, active: false, devices: 0, maxDevices: FAMILY_MAX_DEVICES, owner: false };
  const secret = loyaltySecret();
  if (!familyEnabled() || !secret) return Response.json(off, NO_STORE);
  const cookie = await readFamilyCookie();
  if (!cookie) return Response.json({ ...off, enabled: true }, NO_STORE);
  try {
    const status = await familyStatus(stripe(), cookie, secret);
    return Response.json({ ...off, enabled: true, ...status }, NO_STORE);
  } catch (error) {
    console.error(error);
    return Response.json({ ...off, enabled: true, error: "Could not check your family plan." }, { status: 502, ...NO_STORE });
  }
}
