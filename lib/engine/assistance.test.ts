import { describe, expect, it } from "vitest";
import { assistanceTier, fplPercent, povertyGuideline } from "./assistance";

describe("povertyGuideline (HHS 2026)", () => {
  it("matches the published table", () => {
    expect(povertyGuideline(1, "contiguous")).toBe(15960);
    expect(povertyGuideline(4, "contiguous")).toBe(33000);
    expect(povertyGuideline(8, "contiguous")).toBe(55720);
    expect(povertyGuideline(1, "alaska")).toBe(19950);
    expect(povertyGuideline(2, "hawaii")).toBe(24890);
  });
});

describe("assistanceTier", () => {
  it("puts a family of four at $60,000 in the free-care range", () => {
    const pct = fplPercent({ size: 4, annualIncome: 60000, region: "contiguous" });
    expect(pct).toBe(182);
    expect(assistanceTier(pct)).toBe("free");
  });

  it("puts a single person at $50,000 in the discount range", () => {
    const pct = fplPercent({ size: 1, annualIncome: 50000, region: "contiguous" });
    expect(pct).toBe(313);
    expect(assistanceTier(pct)).toBe("discount");
  });

  it("is unlikely above 400%", () => {
    expect(assistanceTier(fplPercent({ size: 2, annualIncome: 120000, region: "contiguous" }))).toBe(
      "unlikely",
    );
  });
});
