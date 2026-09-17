import type { Candle } from "../types/market";
import { compare, parseDecimal } from "./decimal";

export const INITIAL_CANDLE_LIMIT = 1500;
export const HISTORY_PAGE_SIZE = 1500;

export function mergeCandles(existing: Candle[], incoming: Candle[]): Candle[] {
  if (incoming.length === 0) {
    return existing;
  }
  const byOpenTime = new Map<number, Candle>();
  for (const candle of existing) {
    byOpenTime.set(candle.openTime, candle);
  }
  for (const candle of incoming) {
    byOpenTime.set(candle.openTime, candle);
  }
  return Array.from(byOpenTime.values()).sort((a, b) => a.openTime - b.openTime);
}

export function findNearestCandle<T extends { openTime: number }>(candles: T[], targetMs: number): T | null {
  if (candles.length === 0) {
    return null;
  }
  let nearest = candles[0];
  let best = Math.abs(nearest.openTime - targetMs);
  for (const candle of candles) {
    const diff = Math.abs(candle.openTime - targetMs);
    if (diff < best) {
      best = diff;
      nearest = candle;
    }
  }
  return nearest;
}

export function shouldReplaceWithLatestWindow(
  existing: { openTime: number }[],
  latestPage: { openTime: number }[],
  intervalMs: number,
): boolean {
  if (existing.length === 0 || latestPage.length === 0) {
    return true;
  }
  const existingLast = existing[existing.length - 1].openTime;
  const latestFirst = latestPage[0].openTime;
  return latestFirst > existingLast + intervalMs;
}

export function candleDirection(open: string, close: string): "up" | "down" | "neutral" {
  const cmp = compare(parseDecimal(close), parseDecimal(open));
  if (cmp > 0) {
    return "up";
  }
  if (cmp < 0) {
    return "down";
  }
  return "neutral";
}
