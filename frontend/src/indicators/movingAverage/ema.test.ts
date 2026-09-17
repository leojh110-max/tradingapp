import { describe, expect, it } from "vitest";
import { calculateEma } from "./ema";
import { sequentialSamples } from "../testFixtures";

describe("EMA", () => {
  it("seeds with SMA of the first N samples then recurses", () => {
    const points = calculateEma(sequentialSamples(["1", "2", "3", "4", "5"]), 3);
    expect(points.map((point) => [point.openTime, point.value])).toEqual([
      [1002, "2"],
      [1003, "3"],
      [1004, "4"],
    ]);
  });

  it("does not emit values before N samples exist", () => {
    expect(calculateEma(sequentialSamples(["1", "2"]), 3)).toEqual([]);
  });

  it("matches an independent Python Decimal fixture on BTC prices", () => {
    const points = calculateEma(
      sequentialSamples(["71245.20", "71300.10", "71410.00", "71350.50", "71500.25"]),
      3,
    );
    expect(points).toHaveLength(3);
    expect(points[0]?.value.startsWith("71318.433333333333")).toBe(true);
    expect(points[1]?.value.startsWith("71334.466666666666")).toBe(true);
    expect(points[2]?.value.startsWith("71417.358333333333")).toBe(true);
  });

  it("uses period 1 as the source series itself", () => {
    const points = calculateEma(sequentialSamples(["10", "20", "30"]), 1);
    expect(points.map((point) => point.value)).toEqual(["10", "20", "30"]);
  });
});
