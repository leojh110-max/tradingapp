import { describe, expect, it } from "vitest";
import { dateRangeError, millisToUtcParts, utcDateTimeToMillis } from "./utcDate";

describe("utcDateTimeToMillis", () => {
  it("converts a UTC date and time without local timezone shift", () => {
    expect(utcDateTimeToMillis("2021-05-19", "12:00")).toBe(Date.UTC(2021, 4, 19, 12, 0, 0));
    expect(utcDateTimeToMillis("2017-08-17", "04:00")).toBe(Date.UTC(2017, 7, 17, 4, 0, 0));
  });

  it("rejects invalid calendar dates", () => {
    expect(utcDateTimeToMillis("2021-02-31", "00:00")).toBeNull();
    expect(utcDateTimeToMillis("2021-05-19", "25:00")).toBeNull();
  });

  it("round-trips through UTC parts", () => {
    const ms = Date.UTC(2024, 2, 12, 16, 0, 0);
    expect(millisToUtcParts(ms)).toEqual({ date: "2024-03-12", time: "16:00" });
  });
});

describe("dateRangeError", () => {
  const first = Date.UTC(2017, 7, 17, 4, 0, 0);
  const last = Date.UTC(2026, 8, 15, 23, 59, 0);

  it("uses market bounds instead of hardcoded UI copy only", () => {
    expect(dateRangeError(first, first, last)).toBeNull();
    expect(dateRangeError(last, first, last)).toBeNull();
    expect(dateRangeError(first - 1, first, last)).toBe("Date is outside the available market data range.");
    expect(dateRangeError(last + 60_000, first, last, 60_000)).toBe(
      "Date is outside the available market data range.",
    );
  });
});
