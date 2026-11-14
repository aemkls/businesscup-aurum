import { describe, expect, it, vi } from "vitest";
import { lettersAccess } from "./lettersAccess";
import { OTHER_CASE, PAYMENT_NOT_FOUND, type PaidCaseResult } from "./payments";

const PAID: PaidCaseResult = { ok: true, bound: false };
const OTHER: PaidCaseResult = { ok: false, status: 402, code: "other_case", error: OTHER_CASE };

function checks(opts: { demo?: boolean; sessionId?: string; family?: boolean; paid?: PaidCaseResult; freePass?: boolean }) {
  const order: string[] = [];
  const family = vi.fn(async () => (order.push("family"), opts.family ?? false));
  const paid = vi.fn(async () => (order.push("paid"), opts.paid ?? OTHER));
  const freePass = vi.fn(async () => (order.push("free_pass"), opts.freePass ?? false));
  return { order, family, paid, freePass, run: () => lettersAccess({ demo: opts.demo ?? false, sessionId: opts.sessionId ?? "", family, paid, freePass }) };
}

describe("who gets the letters, in order", () => {
  it("demo mode opens without any check", async () => {
    const c = checks({ demo: true, family: true });
    expect(await c.run()).toEqual({ ok: true, via: "demo" });
    expect(c.order).toEqual([]);
  });

  it("an active family plan comes first: no payment check, no free pass used", async () => {
    const c = checks({ family: true, sessionId: "cs_1", paid: PAID, freePass: true });
    expect(await c.run()).toEqual({ ok: true, via: "family" });
    expect(c.order).toEqual(["family"]);
  });

  it("then a paid session for this bill", async () => {
    const c = checks({ sessionId: "cs_1", paid: PAID, freePass: true });
    expect(await c.run()).toEqual({ ok: true, via: "paid" });
    expect(c.order).toEqual(["family", "paid"]);
  });

  it("then the loyalty card's free pass", async () => {
    const c = checks({ sessionId: "cs_1", paid: OTHER, freePass: true });
    expect(await c.run()).toEqual({ ok: true, via: "free_pass" });
    expect(c.order).toEqual(["family", "paid", "free_pass"]);
  });

  it("without a session id the payment check is skipped", async () => {
    const c = checks({ freePass: true });
    expect(await c.run()).toEqual({ ok: true, via: "free_pass" });
    expect(c.order).toEqual(["family", "free_pass"]);
  });

  it("otherwise 402, with the payment's own reason when there was one", async () => {
    const other = checks({ sessionId: "cs_1", paid: OTHER });
    expect(await other.run()).toEqual({ ok: false, status: 402, code: "other_case", error: OTHER_CASE });
    const none = checks({});
    expect(await none.run()).toEqual({ ok: false, status: 402, code: "not_paid", error: PAYMENT_NOT_FOUND });
    expect(none.order).toEqual(["family", "free_pass"]);
  });
});
