import type { Candle, CandlePage, MarketInfo } from "../types/market";

const API_BASE = "";

async function getJson<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const response = await fetch(url.toString(), signal ? { signal } : undefined);
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: { message?: string } };
      if (body.detail?.message) {
        detail = body.detail.message;
      }
    } catch {
      // Keep the status text when the error body is not JSON.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export function fetchHealth(): Promise<{ status: string; offline: boolean }> {
  return getJson("/api/health");
}

export function fetchMarketInfo(interval?: string, signal?: AbortSignal): Promise<MarketInfo> {
  return getJson("/api/market/info", interval ? { interval } : undefined, signal);
}

export function fetchCandles(
  options: {
    symbol: string;
    interval: string;
    from?: number;
    to?: number;
    limit?: number;
    cutoff?: number;
  },
  signal?: AbortSignal,
): Promise<CandlePage> {
  return getJson(
    "/api/candles",
    {
      symbol: options.symbol,
      interval: options.interval,
      from: options.from,
      to: options.to,
      limit: options.limit,
      cutoff: options.cutoff,
    },
    signal,
  );
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isCandle(value: unknown): value is Candle {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.openTime === "number" &&
    typeof row.open === "string" &&
    typeof row.high === "string" &&
    typeof row.low === "string" &&
    typeof row.close === "string" &&
    typeof row.volume === "string"
  );
}
