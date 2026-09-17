import type { Candle } from "../types/market";
import type { IndicatorSource } from "./types";

export function resolveSource(candle: Candle, source: IndicatorSource): string {
  return candle[source];
}

export function samplesFromCandles(candles: Candle[], source: IndicatorSource): { openTime: number; source: string }[] {
  return candles.map((candle) => ({
    openTime: candle.openTime,
    source: resolveSource(candle, source),
  }));
}

export function applyCutoff<T extends { openTime: number }>(rows: T[], cutoff: number | null): T[] {
  if (cutoff === null) {
    return rows;
  }
  return rows.filter((row) => row.openTime <= cutoff);
}
