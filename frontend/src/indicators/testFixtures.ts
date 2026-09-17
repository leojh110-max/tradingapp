import {
  MACD_DEFAULT_HIST_NEGATIVE,
  MACD_DEFAULT_HIST_POSITIVE,
  MACD_DEFAULT_SIGNAL_COLOR,
  type IndicatorInstance,
  type IndicatorSample,
} from "./types";
import type { Candle } from "../types/market";

export function sample(openTime: number, source: string): IndicatorSample {
  return { openTime, source };
}

export function candle(openTime: number, close: string, extras?: Partial<Candle>): Candle {
  return {
    openTime,
    open: extras?.open ?? close,
    high: extras?.high ?? close,
    low: extras?.low ?? close,
    close,
    volume: extras?.volume ?? "0",
    ...extras,
  };
}

export function instance(partial: Partial<IndicatorInstance> & Pick<IndicatorInstance, "id" | "type">): IndicatorInstance {
  const row: IndicatorInstance = {
    period: 20,
    source: "close",
    color: "#f5c542",
    lineWidth: 2,
    visible: true,
    ...partial,
  };
  if (row.type === "macd") {
    const slowPeriod = row.slowPeriod ?? 26;
    return {
      ...row,
      period: slowPeriod,
      fastPeriod: row.fastPeriod ?? 12,
      slowPeriod,
      signalPeriod: row.signalPeriod ?? 9,
      signalColor: row.signalColor ?? MACD_DEFAULT_SIGNAL_COLOR,
      histogramPositiveColor: row.histogramPositiveColor ?? MACD_DEFAULT_HIST_POSITIVE,
      histogramNegativeColor: row.histogramNegativeColor ?? MACD_DEFAULT_HIST_NEGATIVE,
    };
  }
  return row;
}

export function sequentialSamples(values: string[], start = 1_000): IndicatorSample[] {
  return values.map((value, index) => sample(start + index, value));
}

export function sequentialCandles(values: string[], start = 1_000): Candle[] {
  return values.map((value, index) => candle(start + index, value));
}
