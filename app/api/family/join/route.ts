import { familyEnabled, joinFamily } from "@/lib/family";
import { readFamilyCookie, writeFamilyCookie } from "@/lib/familyCookies";
import { loyaltySecret } from "@/lib/loyalty";
import { stripe } from "@/lib/payments";

/** POST { token }: joins the family plan from an invite link (one use, 7 days, up to 5 devices). */
export async function POST(request: Request) {
  const secret = loyaltySecret();
  if (!familyEnabled() || !secret) {
    return Response.json({ error: "The family plan is not available." }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  try {
    const result = await joinFamily(stripe(), token, await readFamilyCookie(), secret);
    if (!result.ok) return Response.json({ error: result.error, code: result.code }, { status: result.status });
    if (result.cookie) await writeFamilyCookie(result.cookie);
    return Response.json({ ok: true, devices: result.devices, already: Boolean(result.already) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not join the family plan. Please try again." }, { status: 502 });
  }
}
