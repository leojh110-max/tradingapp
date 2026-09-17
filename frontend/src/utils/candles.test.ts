import { describe, expect, it } from "vitest";
import { candleDirection, mergeCandles } from "../utils/candles";
import type { Candle } from "../types/market";

function candle(openTime: number, close = "2"): Candle {
  return {
    openTime,
    open: "1",
    high: "3",
    low: "1",
    close,
    volume: "4",
  };
}

describe("mergeCandles", () => {
  it("keeps chronological unique openTime identity", () => {
    const merged = mergeCandles(
      [candle(3), candle(1)],
      [candle(2), candle(3, "9")],
    );
    expect(merged.map((row) => row.openTime)).toEqual([1, 2, 3]);
    expect(merged[2].close).toBe("9");
  });
});

describe("candleDirection", () => {
  it("uses close versus open", () => {
    expect(candleDirection("10", "11")).toBe("up");
    expect(candleDirection("10", "9")).toBe("down");
    expect(candleDirection("10", "10")).toBe("neutral");
  });
});
