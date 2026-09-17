import { describe, expect, it } from "vitest";
import type { CandlePage } from "../types/market";
import { candle } from "./testFixtures";
import { fetchWarmupCandles, WARMUP_PAGE_LIMIT } from "./warmupLoader";

describe("warmup loader", () => {
  it("requests only actual prior candles via to+limit and pages at the API max", async () => {
    const calls: { to?: number; limit?: number }[] = [];
    const fetchPage = async (options: { to?: number; limit?: number }): Promise<CandlePage> => {
      calls.push({ to: options.to, limit: options.limit });
      if (calls.length === 1) {
        return {
          symbol: "BTCUSDT",
          interval: "1m",
          candles: [candle(80, "3"), candle(90, "4")],
        };
      }
      return {
        symbol: "BTCUSDT",
        interval: "1m",
        candles: [candle(50, "1"), candle(60, "2")],
      };
    };
    const rows = await fetchWarmupCandles({
      symbol: "BTCUSDT",
      interval: "1m",
      beforeOpenTime: 100,
      count: 4,
      pageLimit: 2,
      fetchPage,
    });
    expect(calls[0]?.to).toBe(99);
    expect(calls[0]?.limit).toBe(2);
    expect(calls[1]?.limit).toBe(2);
    expect(rows.map((row) => row.openTime)).toEqual([50, 60, 80, 90]);
    expect(rows.every((row) => row.openTime < 100)).toBe(true);
    expect(WARMUP_PAGE_LIMIT).toBe(5000);
  });

  it("does not invent timestamps when the API returns fewer candles than requested", async () => {
    const rows = await fetchWarmupCandles({
      symbol: "BTCUSDT",
      interval: "1h",
      beforeOpenTime: 500,
      count: 20,
      fetchPage: async () => ({
        symbol: "BTCUSDT",
        interval: "1h",
        candles: [candle(100, "1"), candle(200, "2")],
      }),
    });
    expect(rows).toHaveLength(2);
  });
});
