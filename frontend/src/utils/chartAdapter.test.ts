import { describe, expect, it } from "vitest";
import { chartTimeToOpenTime, toChartCandle } from "./chartAdapter";
import type { Candle } from "../types/market";

const OFFSET_CANDLE: Candle = {
  openTime: 1_512_367_220_799,
  open: "11478.00000000",
  high: "11478.00000000",
  low: "11478.00000000",
  close: "11478.00000000",
  volume: "0.00000000",
};

describe("chart adapter", () => {
  it("preserves openTime identity and does not snap to minute boundaries", () => {
    const point = toChartCandle(OFFSET_CANDLE);
    expect(point.openTime).toBe(1_512_367_220_799);
    expect(point.time).toBe(1_512_367_220_799 / 1000);
    expect(point.time).not.toBe(Math.floor(1_512_367_220_799 / 60_000) * 60);
    expect(chartTimeToOpenTime(point.time)).toBe(OFFSET_CANDLE.openTime);
    expect(point.open).toBe(Number("11478.00000000"));
  });

  it("keeps original strings on the source candle", () => {
    toChartCandle(OFFSET_CANDLE);
    expect(OFFSET_CANDLE.open).toBe("11478.00000000");
    expect(OFFSET_CANDLE.openTime % 60_000).toBe(20_799);
  });
});
