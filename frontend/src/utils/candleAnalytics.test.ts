import { describe, expect, it } from "vitest";
import { analyzeCandle, formatPercentDisplay } from "./candleAnalytics";

describe("analyzeCandle", () => {
  it("computes bullish geometry from OHLC strings", () => {
    const stats = analyzeCandle({
      open: "71245.20",
      high: "72180.50",
      low: "70910.10",
      close: "71840.30",
    });
    expect(stats.direction).toBe("up");
    expect(stats.directionLabel).toBe("Bullish");
    expect(stats.changeSigned).toBe("+595.1");
    expect(stats.range).toBe("1270.4");
    expect(stats.body).toBe("595.1");
    expect(stats.upperWick).toBe("340.2");
    expect(stats.lowerWick).toBe("335.1");
    expect(stats.changePercentSigned).toBe("+0.8353");
    expect(stats.bodyPercent).not.toBeNull();
    expect(stats.upperWickPercent).not.toBeNull();
    expect(stats.lowerWickPercent).not.toBeNull();
  });

  it("computes bearish change with a minus sign", () => {
    const stats = analyzeCandle({
      open: "100.00",
      high: "101.00",
      low: "90.00",
      close: "95.00",
    });
    expect(stats.direction).toBe("down");
    expect(stats.directionLabel).toBe("Bearish");
    expect(stats.changeSigned).toBe("-5");
    expect(stats.upperWick).toBe("1");
    expect(stats.lowerWick).toBe("5");
  });

  it("handles a zero range without dividing", () => {
    const stats = analyzeCandle({
      open: "10",
      high: "10",
      low: "10",
      close: "10",
    });
    expect(stats.direction).toBe("neutral");
    expect(stats.range).toBe("0");
    expect(stats.body).toBe("0");
    expect(stats.upperWick).toBe("0");
    expect(stats.lowerWick).toBe("0");
    expect(stats.bodyPercent).toBeNull();
    expect(stats.upperWickPercent).toBeNull();
    expect(stats.lowerWickPercent).toBeNull();
    expect(formatPercentDisplay(stats.bodyPercent)).toBe("—");
  });

  it("marks change percent unavailable when open is zero", () => {
    const stats = analyzeCandle({
      open: "0",
      high: "1",
      low: "0",
      close: "1",
    });
    expect(stats.changePercent).toBeNull();
    expect(stats.changePercentSigned).toBeNull();
    expect(formatPercentDisplay(stats.changePercentSigned)).toBe("—");
  });
});
