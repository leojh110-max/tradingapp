import { formatDecimal, subtract } from "../../utils/decimal";
import { calculateEmaValues } from "../movingAverage/ema";
import type { IndicatorPoint, IndicatorSample, IndicatorSeriesOutput } from "../types";

export type MacdSeries = {
  macd: IndicatorPoint[];
  signal: IndicatorPoint[];
  histogram: IndicatorPoint[];
};

export function calculateMacd(
  samples: IndicatorSample[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): MacdSeries {
  if (fastPeriod < 1 || slowPeriod < 1 || signalPeriod < 1) {
    throw new Error("MACD lengths must be >= 1");
  }
  if (fastPeriod >= slowPeriod) {
    throw new Error("Fast length must be smaller than slow length.");
  }
  const fast = calculateEmaValues(samples, fastPeriod);
  const slow = calculateEmaValues(samples, slowPeriod);
  const slowByTime = new Map(slow.map((point) => [point.openTime, point.value]));
  const macdValues: { openTime: number; value: ReturnType<typeof subtract> }[] = [];
  for (const point of fast) {
    const slowValue = slowByTime.get(point.openTime);
    if (!slowValue) {
      continue;
    }
    macdValues.push({ openTime: point.openTime, value: subtract(point.value, slowValue) });
  }
  const macd: IndicatorPoint[] = macdValues.map((point) => ({
    openTime: point.openTime,
    value: formatDecimal(point.value),
  }));
  const signalSamples: IndicatorSample[] = macd.map((point) => ({
    openTime: point.openTime,
    source: point.value,
  }));
  const signalValues = calculateEmaValues(signalSamples, signalPeriod);
  const signal: IndicatorPoint[] = signalValues.map((point) => ({
    openTime: point.openTime,
    value: formatDecimal(point.value),
  }));
  const macdByTime = new Map(macdValues.map((point) => [point.openTime, point.value]));
  const histogram: IndicatorPoint[] = [];
  for (const point of signalValues) {
    const macdValue = macdByTime.get(point.openTime);
    if (!macdValue) {
      continue;
    }
    histogram.push({
      openTime: point.openTime,
      value: formatDecimal(subtract(macdValue, point.value)),
    });
  }
  return { macd, signal, histogram };
}

export function macdSeriesOutputs(
  samples: IndicatorSample[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): IndicatorSeriesOutput[] {
  const result = calculateMacd(samples, fastPeriod, slowPeriod, signalPeriod);
  return [
    { key: "macd", title: "MACD", points: result.macd, renderType: "line", valueKind: "priceDelta" },
    { key: "signal", title: "Signal", points: result.signal, renderType: "line", valueKind: "priceDelta" },
    {
      key: "histogram",
      title: "Hist",
      points: result.histogram,
      renderType: "histogram",
      valueKind: "priceDelta",
    },
  ];
}
