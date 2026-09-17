import { describe, expect, it } from "vitest";
import { INDICATORS_STORAGE_KEY } from "./types";
import { loadIndicatorInstances, saveIndicatorInstances } from "./persistence";
import { instance } from "./testFixtures";
import type { StorageLike } from "../utils/chartSettings";

function memoryStorage(initial?: Record<string, string>): StorageLike {
  const store = new Map(Object.entries(initial ?? {}));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

describe("indicator persistence", () => {
  it("round-trips valid instances", () => {
    const storage = memoryStorage();
    const rows = [
      instance({ id: "ind_a", type: "ema", period: 20, source: "close", color: "#5b9dff", lineWidth: 2 }),
      instance({ id: "ind_b", type: "sma", period: 50, source: "high", color: "#c084fc", lineWidth: 3, visible: false }),
    ];
    saveIndicatorInstances(rows, storage);
    expect(storage.getItem(INDICATORS_STORAGE_KEY)).toContain("\"type\":\"ema\"");
    expect(loadIndicatorInstances(storage)).toEqual(rows);
  });

  it("round-trips RSI without dropping existing SMA/EMA payloads", () => {
    const storage = memoryStorage();
    const legacy = JSON.stringify({
      version: 1,
      instances: [
        { id: "ind_a", type: "ema", period: 20, source: "close", color: "#5b9dff", lineWidth: 2, visible: true },
      ],
    });
    expect(loadIndicatorInstances(memoryStorage({ [INDICATORS_STORAGE_KEY]: legacy }))).toEqual([
      instance({ id: "ind_a", type: "ema", period: 20, source: "close", color: "#5b9dff", lineWidth: 2 }),
    ]);
    const mixed = [
      instance({ id: "ind_a", type: "ema", period: 20, source: "close", color: "#5b9dff", lineWidth: 2 }),
      instance({ id: "ind_r", type: "rsi", period: 14, source: "close", color: "#22d3ee", lineWidth: 2, overbought: 70, oversold: 30 }),
    ];
    saveIndicatorInstances(mixed, storage);
    expect(loadIndicatorInstances(storage)).toEqual(mixed);
  });

  it("falls back to an empty list for invalid payloads", () => {
    expect(loadIndicatorInstances(memoryStorage({ [INDICATORS_STORAGE_KEY]: "{nope" }))).toEqual([]);
    expect(
      loadIndicatorInstances(
        memoryStorage({
          [INDICATORS_STORAGE_KEY]: JSON.stringify({
            instances: [{ id: "x", type: "unknown", period: 20, source: "close", color: "#ffffff", lineWidth: 2, visible: true }],
          }),
        }),
      ),
    ).toEqual([]);
  });

  it("round-trips MACD without dropping existing SMA/EMA/RSI payloads", () => {
    const storage = memoryStorage();
    const mixed = [
      instance({ id: "ind_a", type: "ema", period: 20, source: "close", color: "#5b9dff", lineWidth: 2 }),
      instance({ id: "ind_r", type: "rsi", period: 14, source: "close", color: "#22d3ee", lineWidth: 2, overbought: 70, oversold: 30 }),
      instance({
        id: "ind_m",
        type: "macd",
        period: 26,
        source: "close",
        color: "#5b9dff",
        lineWidth: 2,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
      }),
    ];
    saveIndicatorInstances(mixed, storage);
    expect(loadIndicatorInstances(storage)).toEqual(mixed);
  });

  it("ignores invalid persisted MACD without dropping valid neighbors", () => {
    const storage = memoryStorage({
      [INDICATORS_STORAGE_KEY]: JSON.stringify({
        instances: [
          { id: "ind_a", type: "ema", period: 20, source: "close", color: "#5b9dff", lineWidth: 2, visible: true },
          { id: "ind_m", type: "macd", period: 20, source: "close", color: "#ffffff", lineWidth: 2, visible: true },
          { id: "ind_bad", type: "macd", period: 26, source: "close", color: "#ffffff", lineWidth: 2, visible: true, fastPeriod: 26, slowPeriod: 12, signalPeriod: 9 },
        ],
      }),
    });
    expect(loadIndicatorInstances(storage)).toEqual([
      instance({ id: "ind_a", type: "ema", period: 20, source: "close", color: "#5b9dff", lineWidth: 2 }),
    ]);
  });
});
