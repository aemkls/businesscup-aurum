import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed values for cookies and links, server only:
 * base64url(JSON) + "." + base64url(HMAC-SHA256(JSON)), keyed with
 * LOYALTY_SECRET. Every kind of token says what it is for inside the signed
 * JSON (the family tokens carry `purpose`), and each decoder accepts only
 * its own kind, so one kind can never be passed off as another.
 */

function mac(json: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(json).digest();
}

export function sign(payload: object, secret: string): string {
  const json = JSON.stringify(payload);
  return `${Buffer.from(json).toString("base64url")}.${mac(json, secret).toString("base64url")}`;
}

/** The payload if the signature is right, otherwise null. */
export function unsign(value: string | undefined | null, secret: string): unknown {
  if (!value || !secret) return null;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot !== value.lastIndexOf(".")) return null;
  const json = Buffer.from(value.slice(0, dot), "base64url").toString("utf8");
  const given = Buffer.from(value.slice(dot + 1), "base64url");
  const expected = mac(json, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data: unknown = JSON.parse(json);
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** A Stripe-style id or a random id: a short non-empty string. */
export const isId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length < 256;
