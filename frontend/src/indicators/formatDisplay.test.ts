import { describe, expect, it } from "vitest";
import { formatFixedDecimal, formatIndicatorValue } from "./formatDisplay";

describe("indicator display formatting", () => {
  it("shows overlay prices at 2 decimals without changing the engine string", () => {
    const internal = "78555.23802492016130766713";
    expect(formatIndicatorValue(internal, "price")).toBe("78555.24");
    expect(internal).toBe("78555.23802492016130766713");
    expect(formatIndicatorValue("78760.157", "price")).toBe("78760.16");
  });

  it("shows RSI at 2 decimals", () => {
    expect(formatIndicatorValue("58.42413502106", "oscillator")).toBe("58.42");
    expect(formatIndicatorValue("100", "oscillator")).toBe("100.00");
    expect(formatIndicatorValue("0", "oscillator")).toBe("0.00");
  });

  it("shows MACD price-delta values at 2 decimals without changing the engine string", () => {
    const internal = "125.42413502106";
    expect(formatIndicatorValue(internal, "priceDelta")).toBe("125.42");
    expect(internal).toBe("125.42413502106");
    expect(formatIndicatorValue("-27.255", "priceDelta")).toBe("-27.26");
    expect(formatIndicatorValue("0", "generic")).toBe("0.00");
  });

  it("rounds half-up at the display scale", () => {
    expect(formatFixedDecimal("1.225", 2)).toBe("1.23");
  });
});
