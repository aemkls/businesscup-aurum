import { cookies } from "next/headers";
import {
  FREE_PASS_COOKIE,
  FREE_PASS_TTL_MS,
  LOYALTY_COOKIE,
  LOYALTY_MAX_AGE_S,
  decodeFreePass,
  decodeToken,
  loyaltySecret,
  type LoyaltyToken,
} from "./loyalty";

/** Cookie plumbing for the loyalty card. Server only (route handlers). */

const BASE = { httpOnly: true, sameSite: "lax", secure: true, path: "/" } as const;

export async function readLoyaltyCookie(): Promise<string | undefined> {
  return (await cookies()).get(LOYALTY_COOKIE)?.value;
}

export async function readToken(): Promise<LoyaltyToken | null> {
  const secret = loyaltySecret();
  return secret ? decodeToken(await readLoyaltyCookie(), secret) : null;
}

export async function writeLoyaltyCookie(value: string): Promise<void> {
  (await cookies()).set(LOYALTY_COOKIE, value, { ...BASE, maxAge: LOYALTY_MAX_AGE_S });
}

/** The setup session id of a valid free pass in this browser, or null. */
export async function readFreePass(): Promise<string | null> {
  const secret = loyaltySecret();
  if (!secret) return null;
  return decodeFreePass((await cookies()).get(FREE_PASS_COOKIE)?.value, secret);
}

export async function writeFreePass(value: string): Promise<void> {
  (await cookies()).set(FREE_PASS_COOKIE, value, {
    ...BASE,
    maxAge: Math.floor(FREE_PASS_TTL_MS / 1000),
  });
}

export async function clearFreePass(): Promise<void> {
  (await cookies()).set(FREE_PASS_COOKIE, "", { ...BASE, maxAge: 0 });
}
