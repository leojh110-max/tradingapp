import type { Candle, Direction } from "../types/market";
import { candleDirection } from "./candles";

export type ChartCandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  openTime: number;
};

export type ChartVolumePoint = {
  time: number;
  value: number;
  color: string;
  openTime: number;
};

export const CHART_COLORS = {
  up: "#3dd68c",
  down: "#f0616d",
  neutral: "#8b95a7",
} as const;

/**
 * Chart-library adapter. Identity remains `openTime` (unix ms from the API).
 * Numeric conversion is only for plotting; OHLC display must use original strings.
 * Time is passed as seconds so the library can render an axis, without snapping
 * to UTC minute boundaries.
 */
export function toChartCandle(candle: Candle): ChartCandlePoint {
  return {
    time: candle.openTime / 1000,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    openTime: candle.openTime,
  };
}

export function toChartVolume(candle: Candle): ChartVolumePoint {
  const direction = candleDirection(candle.open, candle.close);
  return {
    time: candle.openTime / 1000,
    value: Number(candle.volume),
    color: volumeColor(direction),
    openTime: candle.openTime,
  };
}

export function volumeColor(direction: Direction): string {
  if (direction === "up") {
    return "rgba(61, 214, 140, 0.55)";
  }
  if (direction === "down") {
    return "rgba(240, 97, 109, 0.55)";
  }
  return "rgba(139, 149, 167, 0.45)";
}

export function chartTimeToOpenTime(time: number): number {
  return Math.round(time * 1000);
}
