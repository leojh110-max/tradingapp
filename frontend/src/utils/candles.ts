import type { Candle } from "../types/market";

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

export function candleDirection(open: string, close: string): "up" | "down" | "neutral" {
  const openValue = Number(open);
  const closeValue = Number(close);
  if (closeValue > openValue) {
    return "up";
  }
  if (closeValue < openValue) {
    return "down";
  }
  return "neutral";
}
