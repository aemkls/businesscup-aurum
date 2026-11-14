import { cookies } from "next/headers";
import { FAMILY_COOKIE, FAMILY_MAX_AGE_S } from "./family";

/** Cookie plumbing for the family plan. Server only (route handlers). */

const BASE = { httpOnly: true, sameSite: "lax", secure: true, path: "/" } as const;

export async function readFamilyCookie(): Promise<string | undefined> {
  return (await cookies()).get(FAMILY_COOKIE)?.value;
}

export async function writeFamilyCookie(value: string): Promise<void> {
  (await cookies()).set(FAMILY_COOKIE, value, { ...BASE, maxAge: FAMILY_MAX_AGE_S });
}
