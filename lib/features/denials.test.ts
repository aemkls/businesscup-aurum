import { describe, expect, it } from "vitest";
import { decodeDenial } from "./denials";

describe("decodeDenial", () => {
  it.each([
    ["Coordination of benefits: other insurance information needed", "other_insurance", false],
    ["No prior authorization on file", "prior_authorization", true],
    ["Claim submitted after timely filing limit", "timely_filing", false],
    ["Not deemed medically necessary", "medical_necessity", true],
    ["Missing modifier", "coding_or_missing_info", false],
    ["Duplicate claim, already paid", "duplicate", false],
    ["Provider is out-of-network", "out_of_network", true],
    ["Service excluded under your plan", "not_covered", true],
    ["Coverage not active on date of service", "eligibility", false],
    ["Denied", "unknown", true],
  ])("reads %j as %s", (reason, category, appeal) => {
    const advice = decodeDenial(reason);
    expect(advice.category).toBe(category);
    expect(advice.appeal).toBe(appeal);
    expect(advice.steps.length).toBeGreaterThan(0);
  });
});
