import type { Timeframe } from "../types/market";
import { candlePageSize, TIMEFRAME_MS } from "./timeframes";

export function goToDateQuery(
  anchorMs: number,
  interval: Timeframe,
  firstOpenTime: number | null,
): { from: number; limit: number } {
  const limit = candlePageSize(interval);
  const half = Math.floor(limit / 2);
  const from = anchorMs - half * TIMEFRAME_MS[interval];
  const floor = firstOpenTime ?? 0;
  return { from: Math.max(floor, from), limit };
}
