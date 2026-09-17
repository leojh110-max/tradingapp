import { describe, expect, it } from "vitest";
import { createInstance, toggleInstanceVisible } from "./instances";
import {
  mainStretchFactor,
  overlayChartLines,
  paneChartLines,
  paneStretchFactor,
  uniqueLevels,
  visiblePaneGroups,
} from "./panes";
import { instance, sequentialCandles } from "./testFixtures";
import { computeWindowOutputs } from "./runtime";

describe("pane grouping", () => {
  it("puts multiple RSI instances in one rsi pane group", () => {
    const first = createInstance("rsi", []);
    const second = { ...createInstance("rsi", [first]), period: 7 };
    expect(visiblePaneGroups([first, second])).toEqual(["rsi"]);
    expect(visiblePaneGroups(toggleInstanceVisible([first, second], first.id))).toEqual(["rsi"]);
  });

  it("removes the pane group when the last visible RSI is hidden", () => {
    const rsi = createInstance("rsi", []);
    expect(visiblePaneGroups([rsi])).toEqual(["rsi"]);
    expect(visiblePaneGroups(toggleInstanceVisible([rsi], rsi.id))).toEqual([]);
  });

  it("keeps SMA/EMA on the overlay and RSI on the pane", () => {
    const candles = sequentialCandles(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"]);
    const sma = instance({ id: "s", type: "sma", period: 3 });
    const rsiA = instance({ id: "r14", type: "rsi", period: 7, overbought: 70, oversold: 30 });
    const rsiB = instance({ id: "r7", type: "rsi", period: 5, overbought: 70, oversold: 30, color: "#22d3ee" });
    const runs = computeWindowOutputs([sma, rsiA, rsiB], candles, []);
    const overlay = overlayChartLines([sma, rsiA, rsiB], runs);
    const panes = paneChartLines([sma, rsiA, rsiB], runs);
    expect(overlay.map((row) => row.id)).toEqual(["s"]);
    expect(panes.map((row) => row.id)).toEqual(["r14:value", "r7:value"]);
    expect(new Set(panes.map((row) => row.paneGroup))).toEqual(new Set(["rsi"]));
    expect(uniqueLevels(panes).some((level) => level.price === 70)).toBe(true);
    expect(uniqueLevels(panes).some((level) => level.price === 30)).toBe(true);
    expect(uniqueLevels(panes).some((level) => level.price === 50)).toBe(true);
  });
});

describe("MACD pane grouping and layout", () => {
  it("orders RSI before MACD regardless of instance insertion order", () => {
    const macd = createInstance("macd", []);
    const rsi = createInstance("rsi", [macd]);
    expect(visiblePaneGroups([macd, rsi])).toEqual(["rsi", "macd"]);
    expect(visiblePaneGroups([rsi, macd])).toEqual(["rsi", "macd"]);
  });

  it("shares one macd pane across multiple MACD instances", () => {
    const first = createInstance("macd", []);
    const second = createInstance("macd", [first]);
    second.fastPeriod = 5;
    second.slowPeriod = 35;
    second.signalPeriod = 5;
    second.period = 35;
    expect(visiblePaneGroups([first, second])).toEqual(["macd"]);
  });

  it("removes the MACD pane when the last visible MACD is hidden and restores RSI+MACD lifecycle", () => {
    const rsi = createInstance("rsi", []);
    const macd = createInstance("macd", [rsi]);
    expect(visiblePaneGroups([])).toEqual([]);
    expect(visiblePaneGroups([rsi])).toEqual(["rsi"]);
    expect(visiblePaneGroups([macd])).toEqual(["macd"]);
    expect(visiblePaneGroups([rsi, macd])).toEqual(["rsi", "macd"]);
    expect(visiblePaneGroups(toggleInstanceVisible([rsi, macd], rsi.id))).toEqual(["macd"]);
    expect(visiblePaneGroups(toggleInstanceVisible([rsi, macd], macd.id))).toEqual(["rsi"]);
    expect(visiblePaneGroups(toggleInstanceVisible(toggleInstanceVisible([rsi, macd], rsi.id), macd.id))).toEqual([]);
  });

  it("emits histogram then line series for each MACD instance without mixing ids", () => {
    const candles = sequentialCandles(Array.from({ length: 50 }, (_, index) => String(100 + index)));
    const first = instance({ id: "m1", type: "macd", color: "#5b9dff" });
    const second = instance({
      id: "m2",
      type: "macd",
      fastPeriod: 5,
      slowPeriod: 35,
      signalPeriod: 5,
      period: 35,
      color: "#fb923c",
    });
    const runs = computeWindowOutputs([first, second], candles, []);
    const panes = paneChartLines([first, second], runs);
    expect(panes.every((row) => row.paneGroup === "macd")).toBe(true);
    expect(panes.map((row) => row.id)).toEqual([
      "m1:histogram",
      "m1:macd",
      "m1:signal",
      "m2:histogram",
      "m2:macd",
      "m2:signal",
    ]);
    expect(panes.filter((row) => row.renderType === "histogram")).toHaveLength(2);
    expect(uniqueLevels(panes).some((level) => level.price === 0)).toBe(true);
    expect(panes.every((row) => row.scaleMin != null && row.scaleMax != null && (row.scaleMin as number) <= 0 && (row.scaleMax as number) >= 0)).toBe(true);
  });

  it("keeps SMA overlay, RSI pane, and MACD pane together", () => {
    const candles = sequentialCandles(Array.from({ length: 50 }, (_, index) => String(20 + index)));
    const sma = instance({ id: "s", type: "sma", period: 20 });
    const ema = instance({ id: "e", type: "ema", period: 20 });
    const rsi = instance({ id: "r", type: "rsi", period: 14 });
    const macd = instance({ id: "m", type: "macd" });
    const runs = computeWindowOutputs([sma, ema, rsi, macd], candles, []);
    expect(overlayChartLines([sma, ema, rsi, macd], runs).map((row) => row.id)).toEqual(["s", "e"]);
    const panes = paneChartLines([sma, ema, rsi, macd], runs);
    expect(visiblePaneGroups([sma, ema, rsi, macd])).toEqual(["rsi", "macd"]);
    expect(panes.some((row) => row.paneGroup === "rsi")).toBe(true);
    expect(panes.some((row) => row.paneGroup === "macd" && row.renderType === "histogram")).toBe(true);
    expect(panes.filter((row) => row.paneGroup === "rsi").every((row) => row.scaleMin === 0 && row.scaleMax === 100)).toBe(true);
  });

  it("uses pane-count stretch instead of named RSI/MACD CSS heights", () => {
    expect(paneStretchFactor(0)).toBe(0);
    expect(paneStretchFactor(1)).toBe(0.22);
    expect(mainStretchFactor(["rsi"])).toBeCloseTo(0.78);
    expect(paneStretchFactor(2)).toBeCloseTo(0.19);
    expect(mainStretchFactor(["rsi", "macd"])).toBeCloseTo(0.62);
    expect(mainStretchFactor([])).toBe(1);
  });

  it("hides one MACD instance series without removing another instance from the same pane", () => {
    const first = instance({ id: "m1", type: "macd" });
    const second = instance({ id: "m2", type: "macd", fastPeriod: 5, slowPeriod: 35, signalPeriod: 5, period: 35 });
    const hidden = toggleInstanceVisible([first, second], first.id);
    expect(visiblePaneGroups(hidden)).toEqual(["macd"]);
    const candles = sequentialCandles(Array.from({ length: 50 }, (_, index) => String(10 + index)));
    const panes = paneChartLines(hidden, computeWindowOutputs(hidden, candles, []));
    expect(panes.every((row) => row.instanceId === "m2")).toBe(true);
    expect(panes).toHaveLength(3);
  });
});
