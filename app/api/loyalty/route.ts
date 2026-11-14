import { connection } from "next/server";
import { loyaltyEnabled, loyaltyState } from "@/lib/loyalty";
import { readFreePass, readToken } from "@/lib/loyaltyCookies";

/**
 * GET: the loyalty card as the UI shows it, read from the signed cookie.
 * { enabled, stamps: 0..3, freeAvailable, freePass }. Display only: every
 * decision is made again on the server when the user acts.
 */
export async function GET() {
  await connection(); // per request: never prerendered with the build's env
  if (!loyaltyEnabled()) {
    return Response.json({ enabled: false, stamps: 0, freeAvailable: false, freePass: false });
  }
  const state = loyaltyState(await readToken());
  return Response.json(
    { enabled: true, ...state, freePass: Boolean(await readFreePass()) },
    { headers: { "cache-control": "no-store" } },
  );
}
