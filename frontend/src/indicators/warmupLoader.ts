import { fetchCandles } from "../services/api";
import type { Candle, CandlePage } from "../types/market";
import { mergeCandles } from "../utils/candles";
import { applyCutoff } from "./sources";

export const WARMUP_PAGE_LIMIT = 5000;

export type WarmupPageFn = (
  options: {
    symbol: string;
    interval: string;
    from?: number;
    to?: number;
    limit?: number;
    cutoff?: number;
  },
  signal?: AbortSignal,
) => Promise<CandlePage>;

export async function fetchWarmupCandles(options: {
  symbol: string;
  interval: string;
  beforeOpenTime: number;
  count: number;
  cutoff?: number | null;
  signal?: AbortSignal;
  fetchPage?: WarmupPageFn;
  pageLimit?: number;
}): Promise<Candle[]> {
  if (options.count <= 0) {
    return [];
  }
  const fetchPage = options.fetchPage ?? fetchCandles;
  const pageLimit = options.pageLimit ?? WARMUP_PAGE_LIMIT;
  let collected: Candle[] = [];
  let to = options.beforeOpenTime - 1;
  while (collected.length < options.count) {
    if (options.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const remaining = options.count - collected.length;
    const limit = Math.min(remaining, pageLimit);
    const page = await fetchPage(
      {
        symbol: options.symbol,
        interval: options.interval,
        to,
        limit,
        cutoff: options.cutoff ?? undefined,
      },
      options.signal,
    );
    const rows = applyCutoff(
      page.candles.filter((candle) => candle.openTime < options.beforeOpenTime),
      options.cutoff ?? null,
    );
    if (rows.length === 0) {
      break;
    }
    collected = mergeCandles(rows, collected);
    const oldest = rows[0].openTime;
    if (rows.length < limit || oldest >= to) {
      break;
    }
    to = oldest - 1;
  }
  if (collected.length > options.count) {
    return collected.slice(collected.length - options.count);
  }
  return collected;
}
