import type { Timeframe } from "../types/market";

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "10m", "15m", "30m", "1h", "4h", "1d"];

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "10m": 600_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

export const INITIAL_VISIBLE_BARS = 180;
export const DEFAULT_CANDLE_LIMIT = 1500;

export function candlePageSize(interval: Timeframe): number {
  if (interval === "1d") {
    return 400;
  }
  return DEFAULT_CANDLE_LIMIT;
}

export type TimeRangeMs = {
  from: number;
  to: number;
};

export function clampVisibleTimeRange(
  requested: TimeRangeMs | null,
  intervalMs: number,
  dataFrom: number,
  dataTo: number,
): TimeRangeMs | null {
  if (requested === null || dataTo <= dataFrom) {
    return null;
  }
  const ideal = INITIAL_VISIBLE_BARS * intervalMs;
  const duration = requested.to - requested.from;
  const mid = (requested.from + requested.to) / 2;
  let from = requested.from;
  let to = requested.to;
  if (duration < intervalMs * 30 || duration > intervalMs * 400) {
    from = mid - Math.floor(ideal * 0.85);
    to = mid + Math.floor(ideal * 0.15);
  }
  from = Math.max(from, dataFrom);
  to = Math.min(to, dataTo + intervalMs);
  if (to <= from) {
    return null;
  }
  return { from, to };
}
