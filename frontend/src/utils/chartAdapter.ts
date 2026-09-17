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

export type ChartPalette = {
  up: string;
  down: string;
  neutral?: string;
};

export function volumeColor(direction: Direction, palette: ChartPalette = CHART_COLORS): string {
  if (direction === "up") {
    return hexToRgba(palette.up, 0.55);
  }
  if (direction === "down") {
    return hexToRgba(palette.down, 0.55);
  }
  return hexToRgba(palette.neutral ?? CHART_COLORS.neutral, 0.45);
}

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

export function toChartVolume(candle: Candle, palette: ChartPalette = CHART_COLORS): ChartVolumePoint {
  const direction = candleDirection(candle.open, candle.close);
  return {
    time: candle.openTime / 1000,
    value: Number(candle.volume),
    color: volumeColor(direction, palette),
    openTime: candle.openTime,
  };
}

export function chartTimeToOpenTime(time: number): number {
  return Math.round(time * 1000);
}

export function toChartLinePoint(openTime: number, value: string): { time: number; value: number; openTime: number } {
  return {
    time: openTime / 1000,
    value: Number(value),
    openTime,
  };
}

export function hexToRgba(hex: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/u.exec(hex);
  if (!match) {
    return `rgba(139, 149, 167, ${alpha})`;
  }
  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
