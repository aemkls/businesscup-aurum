import { describe, expect, it } from "vitest";
import { EMPTY_DETAILS, fillLetter, missingPlaceholders } from "./fill";

const LETTER = `[Your full name]
[Your address]
[Date]

Re: account [account number], member [Member ID]

Sincerely,
[Your full name]
[Phone or email]`;

const today = new Date(2026, 10, 14);

describe("fillLetter", () => {
  it("replaces every placeholder the user filled in, everywhere it appears", () => {
    const text = fillLetter(
      LETTER,
      {
        fullName: "Jordan Sample",
        address: "1 Main St\nSpringfield, ST 00000",
        contact: "jordan@example.com",
        accountNumber: "LRM-000000",
        memberId: "NS123",
      },
      today,
    );
    expect(text).toBe(`Jordan Sample
1 Main St
Springfield, ST 00000
November 14, 2026

Re: account LRM-000000, member NS123

Sincerely,
Jordan Sample
jordan@example.com`);
    expect(missingPlaceholders(text)).toEqual([]);
  });

  it("always fills the date and leaves empty fields as visible placeholders", () => {
    const text = fillLetter(LETTER, { ...EMPTY_DETAILS, fullName: "  " }, today);
    expect(text).toContain("November 14, 2026");
    expect(missingPlaceholders(text)).toEqual([
      "[Your full name]",
      "[Your address]",
      "[account number]",
      "[Member ID]",
      "[Phone or email]",
    ]);
  });
});
