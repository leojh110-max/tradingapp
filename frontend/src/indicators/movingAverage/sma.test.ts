import { describe, expect, it } from "vitest";
import { calculateSma } from "./sma";
import { sequentialSamples } from "../testFixtures";

describe("SMA", () => {
  it("uses a known integer fixture and omits the first N-1 values", () => {
    const points = calculateSma(sequentialSamples(["1", "2", "3", "4", "5"]), 3);
    expect(points.map((point) => [point.openTime, point.value])).toEqual([
      [1002, "2"],
      [1003, "3"],
      [1004, "4"],
    ]);
  });

  it("matches the hand-calculated BTC scale-2 mean", () => {
    const points = calculateSma(
      sequentialSamples(["71245.20", "71300.10", "71410.00", "71350.50", "71500.25"]),
      3,
    );
    expect(points[0]?.value).toBe("71318.43");
    expect(points[1]?.value).toBe("71353.53");
    expect(points[2]?.value).toBe("71420.25");
  });

  it("keeps tiny decimals without fabricating zeros during warmup", () => {
    const points = calculateSma(sequentialSamples(["0.00000001", "0.00000002", "0.00000003", "0.00000004"]), 3);
    expect(points).toHaveLength(2);
    expect(points[0]?.value).toBe("0.00000002");
    expect(points[1]?.value).toBe("0.00000003");
  });

  it("is O(n) rolling: extra samples do not change earlier timestamps", () => {
    const first = calculateSma(sequentialSamples(["1", "2", "3", "4"]), 3);
    const extended = calculateSma(sequentialSamples(["1", "2", "3", "4", "5", "6"]), 3);
    expect(extended.slice(0, first.length)).toEqual(first);
  });
});
