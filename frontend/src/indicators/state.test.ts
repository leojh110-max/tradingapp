import { describe, expect, it } from "vitest";
import {
  createInstance,
  instanceLabel,
  removeInstance,
  toggleInstanceVisible,
  updateInstance,
} from "./instances";

describe("indicator instance management", () => {
  it("edits, hides, and removes without using type as a key", () => {
    const first = createInstance("ema", []);
    const second = createInstance("ema", [first]);
    const edited = updateInstance([first, second], first.id, { period: 50, source: "high" });
    expect(edited[0]?.period).toBe(50);
    expect(edited[0]?.source).toBe("high");
    expect(edited[1]?.period).toBe(20);
    const hidden = toggleInstanceVisible(edited, first.id);
    expect(hidden[0]?.visible).toBe(false);
    expect(hidden[1]?.visible).toBe(true);
    const remaining = removeInstance(hidden, first.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(second.id);
    expect(instanceLabel(second)).toBe("EMA 20 close");
  });

  it("creates MACD with 12/26/9 defaults and a unique instance id", () => {
    const first = createInstance("macd", []);
    const second = createInstance("macd", [first]);
    expect(first.fastPeriod).toBe(12);
    expect(first.slowPeriod).toBe(26);
    expect(first.signalPeriod).toBe(9);
    expect(first.period).toBe(26);
    expect(instanceLabel(first)).toBe("MACD 12 26 9");
    expect(first.id).not.toBe(second.id);
    const hidden = toggleInstanceVisible([first, second], first.id);
    expect(hidden[0]?.visible).toBe(false);
    expect(hidden[1]?.visible).toBe(true);
    expect(removeInstance(hidden, first.id)[0]?.id).toBe(second.id);
  });

  it("creates RSI with Wilder defaults and unique instance ids", () => {
    const first = createInstance("rsi", []);
    const second = createInstance("rsi", [first]);
    expect(first.period).toBe(14);
    expect(first.overbought).toBe(70);
    expect(first.oversold).toBe(30);
    expect(first.id).not.toBe(second.id);
  });
});
