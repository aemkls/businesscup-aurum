import { describe, expect, it } from "vitest";
import { buildIcs, isoToDate } from "./tracker";

describe("fixed deadlines in the calendar file", () => {
  it("adds each deadline as an all-day event on its own date", () => {
    const ics = buildIcs(
      "2026-11-10T12:00:00.000Z",
      [],
      [
        {
          id: "deadline-collections",
          title: "Ask the collector to validate the debt",
          detail: "30 days from the first letter",
          date: "2026-12-01",
        },
      ],
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261201");
    expect(ics).toContain("DTEND;VALUE=DATE:20261202");
    expect(ics).toContain("SUMMARY:ClaimBack deadline: Ask the collector to validate the debt");
  });

  it("reads ISO dates as local days, not shifted by the time zone", () => {
    const d = isoToDate("2026-12-01");
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 12, 1]);
  });
});
