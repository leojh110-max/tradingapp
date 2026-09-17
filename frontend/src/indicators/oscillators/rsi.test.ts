import { describe, expect, it } from "vitest";
import { calculateRsi } from "./rsi";
import { sequentialSamples } from "../testFixtures";

describe("Wilder RSI", () => {
  it("omits values until N+1 source candles exist", () => {
    expect(calculateRsi(sequentialSamples(["1", "2", "3"]), 3)).toEqual([]);
    expect(calculateRsi(sequentialSamples(["1", "2", "3", "4"]), 3)).toHaveLength(1);
    expect(calculateRsi(sequentialSamples(["1", "2", "3", "4"]), 3)[0]?.openTime).toBe(1003);
  });

  it("seeds with the mean of the first N gains and losses", () => {
    const points = calculateRsi(sequentialSamples(["1", "2", "3", "2", "1"]), 2);
    expect(points.map((point) => [point.openTime, point.value])).toEqual([
      [1002, "100"],
      [1003, "50"],
      [1004, "25"],
    ]);
  });

  it("returns 100 when average loss is zero and gain is positive", () => {
    const points = calculateRsi(sequentialSamples(["1", "2", "3", "4", "5"]), 2);
    expect(points.every((point) => point.value === "100")).toBe(true);
  });

  it("returns 0 when average gain is zero and loss is positive", () => {
    const points = calculateRsi(sequentialSamples(["5", "4", "3", "2", "1"]), 2);
    expect(points.every((point) => point.value === "0")).toBe(true);
  });

  it("returns 50 when average gain and loss are both zero", () => {
    const points = calculateRsi(sequentialSamples(["10", "10", "10", "10", "10"]), 2);
    expect(points.every((point) => point.value === "50")).toBe(true);
  });

  it("matches an independent Python Decimal Wilder fixture", () => {
    const prices = [
      "44.34",
      "44.09",
      "44.15",
      "43.61",
      "44.33",
      "44.83",
      "45.10",
      "45.42",
      "45.84",
      "46.08",
      "45.89",
      "46.03",
      "45.61",
      "46.28",
      "46.28",
      "46.00",
      "46.03",
      "46.41",
      "46.22",
      "45.64",
    ];
    const points = calculateRsi(sequentialSamples(prices), 14);
    expect(points).toHaveLength(6);
    expect(points[0]?.value.startsWith("70.46413502109")).toBe(true);
    expect(points[1]?.value.startsWith("66.24961855355")).toBe(true);
    expect(points[5]?.value.startsWith("57.91502067008")).toBe(true);
    expect(Number(points[0]?.value)).toBeGreaterThanOrEqual(0);
    expect(Number(points[0]?.value)).toBeLessThanOrEqual(100);
  });

  it("uses open/high/low/close samples as provided", () => {
    const close = calculateRsi(sequentialSamples(["1", "3", "2", "4"]), 2);
    const open = calculateRsi(
      [
        { openTime: 1, source: "10" },
        { openTime: 2, source: "8" },
        { openTime: 3, source: "6" },
      ],
      2,
    );
    expect(close[0]?.value).not.toBe(open[0]?.value);
    expect(open[0]?.value).toBe("0");
  });
});
