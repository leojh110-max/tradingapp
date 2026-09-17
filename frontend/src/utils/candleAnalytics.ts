import type { Candle, Direction } from "../types/market";
import {
  abs,
  compare,
  formatDecimal,
  formatSignedDecimal,
  isZero,
  max,
  min,
  parseDecimal,
  percentOf,
  subtract,
} from "./decimal";

export type CandleAnalytics = {
  direction: Direction;
  directionLabel: "Bullish" | "Bearish" | "Neutral";
  change: string;
  changeSigned: string;
  changePercent: string | null;
  changePercentSigned: string | null;
  range: string;
  body: string;
  upperWick: string;
  lowerWick: string;
  bodyPercent: string | null;
  upperWickPercent: string | null;
  lowerWickPercent: string | null;
};

export function analyzeCandle(candle: Pick<Candle, "open" | "high" | "low" | "close">): CandleAnalytics {
  const open = parseDecimal(candle.open);
  const high = parseDecimal(candle.high);
  const low = parseDecimal(candle.low);
  const close = parseDecimal(candle.close);
  const change = subtract(close, open);
  const range = subtract(high, low);
  const body = abs(change);
  const upperWick = subtract(high, max(open, close));
  const lowerWick = subtract(min(open, close), low);
  const cmp = compare(close, open);
  const direction: Direction = cmp > 0 ? "up" : cmp < 0 ? "down" : "neutral";
  const changePercent = percentOf(change, open);
  const bodyPercent = isZero(range) ? null : percentOf(body, range);
  const upperWickPercent = isZero(range) ? null : percentOf(upperWick, range);
  const lowerWickPercent = isZero(range) ? null : percentOf(lowerWick, range);
  return {
    direction,
    directionLabel: direction === "up" ? "Bullish" : direction === "down" ? "Bearish" : "Neutral",
    change: formatDecimal(change),
    changeSigned: formatSignedDecimal(change),
    changePercent,
    changePercentSigned: signedPercent(changePercent, direction),
    range: formatDecimal(range),
    body: formatDecimal(body),
    upperWick: formatDecimal(upperWick),
    lowerWick: formatDecimal(lowerWick),
    bodyPercent,
    upperWickPercent,
    lowerWickPercent,
  };
}

export function formatPercentDisplay(value: string | null): string {
  if (value === null) {
    return "—";
  }
  return `${value}%`;
}

export function formatSignedPercentDisplay(value: string | null): string {
  if (value === null) {
    return "—";
  }
  return `${value}%`;
}

function signedPercent(value: string | null, direction: Direction): string | null {
  if (value === null) {
    return null;
  }
  if (direction === "neutral" || value === "0") {
    return "0";
  }
  if (value.startsWith("-") || value.startsWith("+")) {
    return value;
  }
  return direction === "down" ? `-${value}` : `+${value}`;
}
