import { describe, expect, it } from "vitest";
import { computeInstance, sliceOutputToWindow, valueAtTime } from "./engine";
import { getIndicatorDefinition, listIndicatorDefinitions } from "./registry";
import { applyCutoff, resolveSource, samplesFromCandles } from "./sources";
import { candle, instance, sequentialCandles } from "./testFixtures";
import { calculateEma } from "./movingAverage/ema";
import { calculateSma } from "./movingAverage/sma";
import { calculateRsi } from "./oscillators/rsi";
import { canAddInstance, parseMacdLengths, parsePeriod, parseRsiLevels } from "./validation";
import { calculationFingerprint, computeWindowOutputs, indicatorRequestKey, isCurrentIndicatorRequest, loadingStatusMessage, nextIndicatorRequestId } from "./runtime";
import { createInstance } from "./instances";
import { abs, compare, fromInteger, multiply, parseDecimal, subtract } from "../utils/decimal";

const OFFSET_20799 = 1_512_367_220_799;
const OFFSET_14789 = 1_518_170_354_789;

function withinRelative(actual: string, expected: string, millionths = 1): boolean {
  const a = parseDecimal(actual);
  const b = parseDecimal(expected);
  if (compare(a, b) === 0) {
    return true;
  }
  const diff = abs(subtract(a, b));
  const mag = b.coeff === 0n ? fromInteger(1) : abs(b);
  return compare(multiply(diff, fromInteger(1_000_000 / millionths)), mag) <= 0;
}

describe("registry", () => {
  it("looks up SMA and EMA overlay definitions", () => {
    expect(getIndicatorDefinition("sma")?.placement).toBe("overlay");
    expect(getIndicatorDefinition("ema")?.shortName).toBe("EMA");
    expect(getIndicatorDefinition("rsi")?.placement).toBe("pane");
    expect(getIndicatorDefinition("rsi")?.paneGroup).toBe("rsi");
    expect(getIndicatorDefinition("macd")?.placement).toBe("pane");
    expect(getIndicatorDefinition("macd")?.paneGroup).toBe("macd");
    expect(listIndicatorDefinitions().map((row) => row.id)).toEqual(["sma", "ema", "rsi", "macd"]);
  });
});

describe("source resolver", () => {
  it("reads open/high/low/close without synthesizing extra sources", () => {
    const row = candle(10, "4", { open: "1", high: "8", low: "0.5" });
    expect(resolveSource(row, "open")).toBe("1");
    expect(resolveSource(row, "high")).toBe("8");
    expect(resolveSource(row, "low")).toBe("0.5");
    expect(resolveSource(row, "close")).toBe("4");
    expect(samplesFromCandles([row], "high")[0]?.source).toBe("8");
  });
});

describe("period validation", () => {
  it("rejects empty, decimal, zero, and oversized periods", () => {
    expect(parsePeriod("").ok).toBe(false);
    expect(parsePeriod("1.5").ok).toBe(false);
    expect(parsePeriod("0").ok).toBe(false);
    expect(parsePeriod("-3").ok).toBe(false);
    expect(parsePeriod("5001").ok).toBe(false);
    expect(parsePeriod("20")).toEqual({ ok: true, value: 20 });
    expect(canAddInstance(20).ok).toBe(false);
    expect(canAddInstance(19).ok).toBe(true);
    expect(parseRsiLevels("30", "70")).toEqual({ ok: true, oversold: 30, overbought: 70 });
    expect(parseRsiLevels("70", "30").ok).toBe(false);
    expect(parseRsiLevels("-1", "70").ok).toBe(false);
    expect(parseRsiLevels("30", "101").ok).toBe(false);
    expect(parseMacdLengths("12", "26", "9")).toEqual({
      ok: true,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });
    expect(parseMacdLengths("26", "12", "9").ok).toBe(false);
    expect(parseMacdLengths("12", "12", "9").ok).toBe(false);
    expect(parseMacdLengths("12", "26", "0").ok).toBe(false);
    const fastSlow = parseMacdLengths("26", "12", "9");
    expect(fastSlow.ok).toBe(false);
    if (!fastSlow.ok) {
      expect(fastSlow.message).toBe("Fast length must be smaller than slow length.");
    }
  });
});

describe("instances", () => {
  it("gives each instance a unique id even for the same type and period", () => {
    const first = createInstance("ema", []);
    const second = createInstance("ema", [first]);
    expect(first.id).not.toBe(second.id);
    expect(first.period).toBe(20);
    expect(second.color).not.toBe(first.color);
  });
});

describe("engine outputs", () => {
  it("preserves 1m offset timestamps on SMA/EMA points", () => {
    const candles = [
      candle(OFFSET_20799, "10"),
      candle(OFFSET_20799 + 60_000, "20"),
      candle(OFFSET_14789, "30"),
    ];
    const sma = computeInstance(instance({ id: "a", type: "sma", period: 2 }), candles);
    expect(sma.series[0]?.points.map((point) => point.openTime)).toEqual([OFFSET_20799 + 60_000, OFFSET_14789]);
    expect(sma.series[0]?.points[0]?.openTime % 60_000).toBe(20_799);
    const ema = computeInstance(instance({ id: "b", type: "ema", period: 2 }), candles);
    expect(ema.series[0]?.points[0]?.openTime).toBe(OFFSET_20799 + 60_000);
    expect(ema.series[0]?.points[0]?.openTime).not.toBe(Math.floor((OFFSET_20799 + 60_000) / 60_000) * 60_000);
    const rsi = computeInstance(instance({ id: "r", type: "rsi", period: 2 }), candles);
    expect(rsi.series[0]?.points[0]?.openTime).toBe(OFFSET_14789);
    expect(rsi.series[0]?.points[0]?.openTime % 60_000).toBe(14_789);
  });

  it("uses HTF bucket openTime as provided by the API", () => {
    const bucket = 1_512_367_200_000;
    const candles = [candle(bucket, "1"), candle(bucket + 300_000, "2"), candle(bucket + 600_000, "3")];
    const output = computeInstance(instance({ id: "h", type: "sma", period: 2 }), candles);
    expect(output.series[0]?.points.map((p) => p.openTime)).toEqual([bucket + 300_000, bucket + 600_000]);
    const rsi = computeInstance(instance({ id: "hr", type: "rsi", period: 2 }), candles);
    expect(rsi.series[0]?.points.map((p) => p.openTime)).toEqual([bucket + 600_000]);
  });

  it("walks real chronological samples across a RAW gap and does not fill empty UTC buckets", () => {
    const candles = [
      candle(1_000, "1"),
      candle(2_000, "2"),
      candle(3_000, "3"),
      candle(10_000, "4"),
      candle(11_000, "5"),
    ];
    const sma = calculateSma(
      candles.map((row) => ({ openTime: row.openTime, source: row.close })),
      3,
    );
    expect(sma.map((point) => [point.openTime, point.value])).toEqual([
      [3_000, "2"],
      [10_000, "3"],
      [11_000, "4"],
    ]);
    const ema = calculateEma(
      candles.map((row) => ({ openTime: row.openTime, source: row.close })),
      3,
    );
    expect(ema[0]?.openTime).toBe(3_000);
    expect(ema[1]?.openTime).toBe(10_000);
    expect(ema.map((point) => point.openTime)).not.toContain(4_000);
    const rsi = calculateRsi(
      candles.map((row) => ({ openTime: row.openTime, source: row.close })),
      2,
    );
    expect(rsi.map((point) => point.openTime)).toEqual([3_000, 10_000, 11_000]);
    expect(rsi.map((point) => point.openTime)).not.toContain(4_000);
  });

  it("excludes cutoff-future candles from input and output", () => {
    const candles = sequentialCandles(["1", "2", "3", "4", "5"]);
    const cutoff = candles[2].openTime;
    const output = computeInstance(instance({ id: "c", type: "ema", period: 2 }), candles, cutoff);
    expect(output.series[0]?.points.every((point) => point.openTime <= cutoff)).toBe(true);
    expect(output.series[0]?.points.some((point) => point.openTime === candles[3].openTime)).toBe(false);
    expect(applyCutoff(candles, cutoff)).toHaveLength(3);
    const rsi = computeInstance(instance({ id: "rc", type: "rsi", period: 2 }), candles, cutoff);
    expect(rsi.series[0]?.points.every((point) => point.openTime <= cutoff)).toBe(true);
    expect(rsi.series[0]?.points.some((point) => point.openTime === candles[3].openTime)).toBe(false);
  });

  it("uses a partial HTF candle already present in the API result and never a later complete bar", () => {
    const candles = [
      candle(1_000, "10.0"),
      candle(2_000, "20.0"),
      candle(3_000, "21.0", { complete: false, sourceCandleCount: 2, expectedCandleCount: 5 }),
    ];
    const output = computeInstance(instance({ id: "p", type: "sma", period: 2 }), candles, 3_000);
    expect(output.series[0]?.points.at(-1)?.value).toBe("20.5");
    expect(output.series[0]?.points.at(-1)?.openTime).toBe(3_000);
  });

  it("returns — semantics: missing timestamps are null, not nearest neighbors", () => {
    const candles = sequentialCandles(["1", "2", "3", "4"]);
    const output = computeInstance(instance({ id: "v", type: "sma", period: 3 }), candles);
    expect(valueAtTime(output, candles[0].openTime)).toBeNull();
    expect(valueAtTime(output, candles[2].openTime)).toBe("2");
    expect(valueAtTime(output, 999_999)).toBeNull();
  });

  it("computes multiple instances independently", () => {
    const candles = sequentialCandles(["1", "2", "3", "4", "5", "6"]);
    const runs = computeWindowOutputs(
      [
        instance({ id: "ema20", type: "ema", period: 3 }),
        instance({ id: "sma100", type: "sma", period: 3 }),
      ],
      candles.slice(2),
      candles.slice(0, 2),
    );
    expect(runs).toHaveLength(2);
    expect(runs[0]?.output.instanceId).toBe("ema20");
    expect(runs[1]?.output.series[0]?.points.length).toBeGreaterThan(0);
  });

  it("slices warm-up points out of the displayed window", () => {
    const candles = sequentialCandles(["1", "2", "3", "4", "5"]);
    const full = computeInstance(instance({ id: "s", type: "sma", period: 2 }), candles);
    const sliced = sliceOutputToWindow(full, new Set([candles[3].openTime, candles[4].openTime]));
    expect(sliced.series[0]?.points.map((point) => point.openTime)).toEqual([candles[3].openTime, candles[4].openTime]);
  });
});

describe("request identity", () => {
  it("discards stale indicator generations", () => {
    const first = nextIndicatorRequestId(0);
    const second = nextIndicatorRequestId(first);
    expect(isCurrentIndicatorRequest(second, first)).toBe(false);
    expect(isCurrentIndicatorRequest(second, second)).toBe(true);
  });

  it("includes MACD lengths in the calculation fingerprint and omits chart type", () => {
    const macd = instance({ id: "m", type: "macd", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
    const edited = { ...macd, fastPeriod: 5, slowPeriod: 35, signalPeriod: 5, period: 35 };
    expect(calculationFingerprint([macd])).not.toBe(calculationFingerprint([edited]));
    expect(calculationFingerprint([{ ...macd, color: "#ffffff", lineWidth: 4 }])).toBe(calculationFingerprint([macd]));
  });

  it("does not include chart type in the calculation key", () => {
    const key = indicatorRequestKey({
      interval: "1h",
      firstOpenTime: 1,
      lastOpenTime: 2,
      length: 10,
      fingerprint: "ema",
      cutoff: null,
    });
    expect(key).toContain("1h");
    expect(key).not.toContain("candles");
    expect(key).not.toContain("line");
  });

  it("names MACD loading after 12/26/9 lengths", () => {
    expect(loadingStatusMessage([instance({ id: "m", type: "macd" })])).toBe("Calculating MACD 12 26 9…");
  });
});

describe("historical consistency", () => {
  it("keeps SMA identical across Go to Date, extra history, and a long prefix", () => {
    const prices = Array.from({ length: 80 }, (_, index) => String(100 + (index % 7)));
    const candles = sequentialCandles(prices, 10_000);
    const target = candles[50];
    const smaFull = calculateSma(
      candles.map((row) => ({ openTime: row.openTime, source: row.close })),
      5,
    );
    const fromDate = candles.slice(40, 70);
    const warmup = candles.slice(36, 40);
    const fromDateOut = computeWindowOutputs(
      [instance({ id: "s", type: "sma", period: 5 })],
      fromDate,
      warmup,
    )[0]?.output.series[0]?.points.find((point) => point.openTime === target.openTime);
    const lazy = computeWindowOutputs(
      [instance({ id: "s", type: "sma", period: 5 })],
      candles.slice(20, 70),
      candles.slice(16, 20),
    )[0]?.output.series[0]?.points.find((point) => point.openTime === target.openTime);
    const latest = smaFull.find((point) => point.openTime === target.openTime);
    expect(fromDateOut?.value).toBe(latest?.value);
    expect(lazy?.value).toBe(latest?.value);
  });

  it("keeps EMA within 1e-6 relative across the same three history paths", () => {
    const prices = Array.from({ length: 400 }, (_, index) => String(1000 + (index % 17) * 3 + index * 0.01));
    const candles = sequentialCandles(prices, 50_000);
    const period = 10;
    const target = candles[300];
    const full = calculateEma(
      candles.map((row) => ({ openTime: row.openTime, source: row.close })),
      period,
    );
    const fullValue = full.find((point) => point.openTime === target.openTime)?.value;
    expect(fullValue).toBeTruthy();
    const fromDate = computeWindowOutputs(
      [instance({ id: "e", type: "ema", period })],
      candles.slice(250, 350),
      candles.slice(250 - 80, 250),
    )[0]?.output.series[0]?.points.find((point) => point.openTime === target.openTime)?.value;
    const lazy = computeWindowOutputs(
      [instance({ id: "e", type: "ema", period })],
      candles.slice(180, 350),
      candles.slice(180 - 80, 180),
    )[0]?.output.series[0]?.points.find((point) => point.openTime === target.openTime)?.value;
    expect(fromDate).toBeTruthy();
    expect(lazy).toBeTruthy();
    expect(withinRelative(fromDate ?? "", fullValue ?? "")).toBe(true);
    expect(withinRelative(lazy ?? "", fullValue ?? "")).toBe(true);
    expect(withinRelative(fromDate ?? "", lazy ?? "")).toBe(true);
  });

  it("keeps RSI within 1e-6 relative across Go to Date, lazy load, and a long prefix", () => {
    const prices = Array.from({ length: 400 }, (_, index) => String(1000 + (index % 17) * 3 + index * 0.01));
    const candles = sequentialCandles(prices, 50_000);
    const period = 10;
    const target = candles[300];
    const full = calculateRsi(
      candles.map((row) => ({ openTime: row.openTime, source: row.close })),
      period,
    );
    const fullValue = full.find((point) => point.openTime === target.openTime)?.value;
    expect(fullValue).toBeTruthy();
    const fromDate = computeWindowOutputs(
      [instance({ id: "r", type: "rsi", period })],
      candles.slice(250, 350),
      candles.slice(250 - 120, 250),
    )[0]?.output.series[0]?.points.find((point) => point.openTime === target.openTime)?.value;
    const lazy = computeWindowOutputs(
      [instance({ id: "r", type: "rsi", period })],
      candles.slice(180, 350),
      candles.slice(180 - 120, 180),
    )[0]?.output.series[0]?.points.find((point) => point.openTime === target.openTime)?.value;
    expect(fromDate).toBeTruthy();
    expect(lazy).toBeTruthy();
    expect(withinRelative(fromDate ?? "", fullValue ?? "")).toBe(true);
    expect(withinRelative(lazy ?? "", fullValue ?? "")).toBe(true);
  });
});
