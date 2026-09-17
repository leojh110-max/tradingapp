import { describe, expect, it } from "vitest";
import { computeInstance, seriesValuesAtTime, sliceOutputToWindow, valueAtTime } from "../engine";
import { histogramBarColor, histogramPolarity } from "../histogram";
import { calculateEma } from "../movingAverage/ema";
import { calculateMacd } from "./macd";
import { instance, sequentialCandles, sequentialSamples } from "../testFixtures";
import { computeWindowOutputs } from "../runtime";
import { abs, compare, fromInteger, multiply, parseDecimal, subtract } from "../../utils/decimal";
import { MACD_DEFAULT_HIST_NEGATIVE, MACD_DEFAULT_HIST_POSITIVE, MACD_HIST_ZERO_COLOR } from "../types";

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

describe("MACD calculator", () => {
  it("reuses EMA seed/recurrence for fast and slow and does not emit MACD until both exist", () => {
    const samples = sequentialSamples(["1", "2", "3", "4", "5", "6", "7"]);
    const result = calculateMacd(samples, 2, 3, 2);
    const fast = calculateEma(samples, 2);
    const slow = calculateEma(samples, 3);
    expect(result.macd).toHaveLength(slow.length);
    expect(result.macd[0]?.openTime).toBe(slow[0]?.openTime);
    expect(result.macd[0]?.openTime).toBe(fast[1]?.openTime);
    expect(result.macd.map((point) => point.value)).toEqual(["0.5", "0.5", "0.5", "0.5", "0.5"]);
  });

  it("seeds Signal as SMA of the first signalPeriod MACD values and does not fabricate earlier signals", () => {
    const result = calculateMacd(sequentialSamples(["1", "2", "3", "4", "5", "6", "7"]), 2, 3, 2);
    expect(result.signal[0]?.openTime).toBe(1003);
    expect(result.macd.some((point) => point.openTime === 1002)).toBe(true);
    expect(result.signal.some((point) => point.openTime === 1002)).toBe(false);
    expect(result.signal.map((point) => point.value)).toEqual(["0.5", "0.5", "0.5", "0.5"]);
  });

  it("emits Histogram only where Signal exists, never a fabricated 0 beforehand", () => {
    const result = calculateMacd(sequentialSamples(["1", "2", "3", "4", "5", "6", "7"]), 2, 3, 2);
    expect(result.histogram.map((point) => point.openTime)).toEqual(result.signal.map((point) => point.openTime));
    expect(result.histogram.some((point) => point.openTime === 1002)).toBe(false);
    expect(result.histogram.every((point) => point.value === "0")).toBe(true);
  });

  it("matches an independent Python Decimal hand-computable 2/3/2 series", () => {
    const result = calculateMacd(sequentialSamples(["1", "2", "3", "4", "5", "6", "7"]), 2, 3, 2);
    expect(result.macd[0]?.value).toBe("0.5");
    expect(result.signal[0]?.value).toBe("0.5");
    expect(result.histogram[0]?.value).toBe("0");
  });

  it("matches an independent Python Decimal irregular fixture for fast/slow/signal/histogram", () => {
    const prices = ["10", "12", "11", "15", "14", "18", "16", "20", "19", "22", "21", "25"];
    const result = calculateMacd(sequentialSamples(prices), 2, 4, 2);
    expect(result.macd[0]?.value.startsWith("1.666666666667")).toBe(true);
    expect(result.signal[0]?.value.startsWith("1.377777777778")).toBe(true);
    expect(result.signal[1]?.value.startsWith("1.625679012346")).toBe(true);
    expect(result.histogram[0]?.value.startsWith("-0.288888888889")).toBe(true);
    expect(result.histogram[1]?.value.startsWith("0.123950617284")).toBe(true);
  });

  it("goes to zero on a constant source after sufficient samples", () => {
    const result = calculateMacd(sequentialSamples(Array.from({ length: 40 }, () => "100")), 12, 26, 9);
    expect(result.macd.length).toBeGreaterThan(0);
    expect(result.signal.length).toBeGreaterThan(0);
    expect(result.histogram.length).toBeGreaterThan(0);
    expect(result.macd.every((point) => point.value === "0")).toBe(true);
    expect(result.signal.every((point) => point.value === "0")).toBe(true);
    expect(result.histogram.every((point) => point.value === "0")).toBe(true);
  });

  it("matches an independent Python Decimal monotonic 12/26/9 fixture numerically, not just by sign", () => {
    const prices = Array.from({ length: 80 }, (_, index) => String(index + 1));
    const result = calculateMacd(sequentialSamples(prices), 12, 26, 9);
    expect(result.macd[0]?.value).toBe("7");
    expect(result.signal[0]?.value).toBe("7");
    expect(result.histogram[0]?.value).toBe("0");
    expect(result.macd[20]?.value).toBe("7");
  });

  it("matches an independent Python Decimal BTC-like 12/26/9 fixture", () => {
    const prices = ["71245.20", "71300.10", "71410.00", "71350.50", "71500.25"].concat(
      Array.from({ length: 40 }, (_, index) => String(71500 + index * 12.5)),
    );
    const result = calculateMacd(sequentialSamples(prices), 12, 26, 9);
    expect(result.macd[0]?.value.startsWith("102.908362740983")).toBe(true);
    expect(result.signal[0]?.value.startsWith("99.815740080361")).toBe(true);
    expect(result.signal[1]?.value.startsWith("99.120429340733")).toBe(true);
    expect(result.histogram[0]?.value.startsWith("-2.861573027707")).toBe(true);
  });

  it("rejects fast >= slow", () => {
    expect(() => calculateMacd(sequentialSamples(["1", "2", "3"]), 12, 12, 9)).toThrow(
      "Fast length must be smaller than slow length.",
    );
  });
});

describe("MACD engine output", () => {
  it("exposes three named series with line/histogram metadata", () => {
    const candles = sequentialCandles(Array.from({ length: 40 }, (_, index) => String(10 + index)));
    const output = computeInstance(instance({ id: "m", type: "macd" }), candles);
    expect(output.series.map((row) => row.key)).toEqual(["macd", "signal", "histogram"]);
    expect(output.series.map((row) => row.renderType)).toEqual(["line", "line", "histogram"]);
    expect(output.series.every((row) => row.valueKind === "priceDelta")).toBe(true);
    expect(output.series[0]?.points.length).toBeGreaterThan(output.series[1]?.points.length ?? 0);
    expect(output.series[2]?.points.length).toBe(output.series[1]?.points.length);
  });

  it("preserves 1m offset timestamps on MACD/Signal/Histogram", () => {
    const candles = [
      candleOffset(OFFSET_20799, "10"),
      candleOffset(OFFSET_20799 + 60_000, "20"),
      candleOffset(OFFSET_20799 + 120_000, "30"),
      candleOffset(OFFSET_14789, "40"),
      candleOffset(OFFSET_14789 + 60_000, "50"),
    ];
    const output = computeInstance(
      instance({ id: "m", type: "macd", fastPeriod: 2, slowPeriod: 3, signalPeriod: 2, period: 3 }),
      candles,
    );
    const macdTimes = output.series.find((row) => row.key === "macd")?.points.map((point) => point.openTime) ?? [];
    const signalTimes = output.series.find((row) => row.key === "signal")?.points.map((point) => point.openTime) ?? [];
    expect(macdTimes[0]).toBe(OFFSET_20799 + 120_000);
    expect(macdTimes.at(-1)).toBe(OFFSET_14789 + 60_000);
    expect(macdTimes[0] % 60_000).toBe(20_799);
    expect(signalTimes[0]).toBe(OFFSET_14789);
    expect(signalTimes[0] % 60_000).toBe(14_789);
    expect(output.series.find((row) => row.key === "histogram")?.points[0]?.openTime).toBe(OFFSET_14789);
  });

  it("uses HTF bucket openTime as provided by the API", () => {
    const bucket = 1_512_367_200_000;
    const candles = [0, 1, 2, 3, 4].map((index) =>
      candleOffset(bucket + index * 300_000, String(10 + index)),
    );
    const output = computeInstance(
      instance({ id: "h", type: "macd", fastPeriod: 2, slowPeriod: 3, signalPeriod: 2, period: 3 }),
      candles,
    );
    expect(output.series[0]?.points[0]?.openTime).toBe(bucket + 600_000);
  });

  it("walks real chronological samples across a RAW gap and does not fill empty UTC buckets", () => {
    const candles = [
      candleOffset(1_000, "1"),
      candleOffset(2_000, "2"),
      candleOffset(3_000, "3"),
      candleOffset(10_000, "4"),
      candleOffset(11_000, "5"),
      candleOffset(12_000, "6"),
    ];
    const output = computeInstance(
      instance({ id: "g", type: "macd", fastPeriod: 2, slowPeriod: 3, signalPeriod: 2, period: 3 }),
      candles,
    );
    const times = output.series[0]?.points.map((point) => point.openTime) ?? [];
    expect(times).toEqual([3_000, 10_000, 11_000, 12_000]);
    expect(times).not.toContain(4_000);
  });

  it("excludes cutoff-future candles from MACD input and output", () => {
    const candles = sequentialCandles(["1", "2", "3", "4", "5", "6", "7", "8"]);
    const cutoff = candles[5].openTime;
    const output = computeInstance(
      instance({ id: "c", type: "macd", fastPeriod: 2, slowPeriod: 3, signalPeriod: 2, period: 3 }),
      candles,
      cutoff,
    );
    for (const series of output.series) {
      expect(series.points.every((point) => point.openTime <= cutoff)).toBe(true);
      expect(series.points.some((point) => point.openTime === candles[6].openTime)).toBe(false);
    }
  });

  it("returns null at missing timestamps instead of the nearest MACD value", () => {
    const candles = sequentialCandles(["1", "2", "3", "4", "5", "6", "7"]);
    const output = computeInstance(
      instance({ id: "v", type: "macd", fastPeriod: 2, slowPeriod: 3, signalPeriod: 2, period: 3 }),
      candles,
    );
    expect(valueAtTime(output, candles[0].openTime, "macd")).toBeNull();
    expect(valueAtTime(output, 999_999, "macd")).toBeNull();
    expect(seriesValuesAtTime(output, candles[0].openTime).every((row) => row.value === null)).toBe(true);
    expect(valueAtTime(output, candles[2].openTime, "macd")).not.toBeNull();
  });

  it("keeps two MACD instances isolated", () => {
    const candles = sequentialCandles(Array.from({ length: 50 }, (_, index) => String(100 + index)));
    const first = instance({ id: "a", type: "macd", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, period: 26 });
    const second = instance({
      id: "b",
      type: "macd",
      fastPeriod: 5,
      slowPeriod: 35,
      signalPeriod: 5,
      period: 35,
      color: "#22d3ee",
    });
    const runs = computeWindowOutputs([first, second], candles, []);
    expect(runs[0]?.output.instanceId).toBe("a");
    expect(runs[1]?.output.instanceId).toBe("b");
    expect(runs[0]?.output.series[0]?.points[0]?.value).not.toBe(runs[1]?.output.series[0]?.points[0]?.value);
  });

  it("slices warm-up MACD points out of the displayed window", () => {
    const candles = sequentialCandles(Array.from({ length: 20 }, (_, index) => String(index + 1)));
    const full = computeInstance(
      instance({ id: "s", type: "macd", fastPeriod: 2, slowPeriod: 3, signalPeriod: 2, period: 3 }),
      candles,
    );
    const sliced = sliceOutputToWindow(full, new Set([candles[18].openTime, candles[19].openTime]));
    expect(sliced.series[0]?.points.map((point) => point.openTime)).toEqual([
      candles[18].openTime,
      candles[19].openTime,
    ]);
  });
});

describe("MACD historical consistency", () => {
  it("keeps MACD/Signal/Histogram within 1e-6 relative across Go to Date, lazy load, and a long prefix", () => {
    const prices = Array.from({ length: 900 }, (_, index) => String(1000 + (index % 17) * 3 + index * 0.01));
    const candles = sequentialCandles(prices, 50_000);
    const settings = instance({ id: "m", type: "macd", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, period: 26 });
    const target = candles[700];
    const full = computeInstance(settings, candles);
    const keys = ["macd", "signal", "histogram"] as const;
    const fromDate = computeWindowOutputs([settings], candles.slice(650, 800), candles.slice(650 - 356, 650))[0]?.output;
    const lazy = computeWindowOutputs([settings], candles.slice(500, 800), candles.slice(500 - 356, 500))[0]?.output;
    for (const key of keys) {
      const fullValue = full.series.find((row) => row.key === key)?.points.find((point) => point.openTime === target.openTime)?.value;
      const dateValue = fromDate?.series.find((row) => row.key === key)?.points.find((point) => point.openTime === target.openTime)?.value;
      const lazyValue = lazy?.series.find((row) => row.key === key)?.points.find((point) => point.openTime === target.openTime)?.value;
      expect(fullValue).toBeTruthy();
      expect(dateValue).toBeTruthy();
      expect(lazyValue).toBeTruthy();
      expect(withinRelative(dateValue ?? "", fullValue ?? "")).toBe(true);
      expect(withinRelative(lazyValue ?? "", fullValue ?? "")).toBe(true);
      expect(withinRelative(dateValue ?? "", lazyValue ?? "")).toBe(true);
    }
  });
});

describe("histogram polarity", () => {
  it("maps positive, negative, and zero independently of series rendering", () => {
    expect(histogramPolarity("1.25")).toBe("positive");
    expect(histogramPolarity("-0.4")).toBe("negative");
    expect(histogramPolarity("0")).toBe("zero");
    expect(histogramPolarity("-0.0")).toBe("zero");
    expect(
      histogramBarColor("2", {
        positive: MACD_DEFAULT_HIST_POSITIVE,
        negative: MACD_DEFAULT_HIST_NEGATIVE,
        zero: MACD_HIST_ZERO_COLOR,
      }),
    ).toBe(MACD_DEFAULT_HIST_POSITIVE);
    expect(
      histogramBarColor("-2", {
        positive: MACD_DEFAULT_HIST_POSITIVE,
        negative: MACD_DEFAULT_HIST_NEGATIVE,
      }),
    ).toBe(MACD_DEFAULT_HIST_NEGATIVE);
    expect(
      histogramBarColor("0", {
        positive: MACD_DEFAULT_HIST_POSITIVE,
        negative: MACD_DEFAULT_HIST_NEGATIVE,
      }),
    ).toBe(MACD_HIST_ZERO_COLOR);
  });
});

function candleOffset(openTime: number, close: string) {
  return sequentialCandles([close], openTime)[0];
}
