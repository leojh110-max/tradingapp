import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCandles, fetchMarketInfo } from "../services/api";
import type { Candle, MarketInfo, Timeframe } from "../types/market";
import { mergeCandles } from "../utils/candles";
import { candlePageSize, type TimeRangeMs } from "../utils/timeframes";

type Status = "loading" | "ready" | "error";

export function useMarketData() {
  const [interval, setIntervalState] = useState<Timeframe>("1m");
  const [info, setInfo] = useState<MarketInfo | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [restoreRange, setRestoreRange] = useState<TimeRangeMs | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const infoRef = useRef<MarketInfo | null>(null);
  const intervalRef = useRef<Timeframe>(interval);
  const inFlightRef = useRef(false);
  const restoreToRef = useRef<number | null>(null);

  candlesRef.current = candles;
  infoRef.current = info;
  intervalRef.current = interval;

  useEffect(() => {
    let cancelled = false;
    inFlightRef.current = false;
    setStatus("loading");
    setError(null);
    setHasOlder(true);
    (async () => {
      try {
        const market = await fetchMarketInfo(interval);
        const to = restoreToRef.current ?? undefined;
        restoreToRef.current = null;
        const pageSize = candlePageSize(interval);
        const page = await fetchCandles({
          symbol: market.symbol,
          interval,
          to,
          limit: pageSize,
        });
        if (cancelled) {
          return;
        }
        setInfo(market);
        setCandles(page.candles);
        setHasOlder(hasMoreHistory(page.candles, market));
        setStatus("ready");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load market data");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [interval]);

  const loadOlder = useCallback(async (): Promise<number> => {
    const current = candlesRef.current;
    const market = infoRef.current;
    const activeInterval = intervalRef.current;
    if (inFlightRef.current || !hasOlder || current.length === 0 || market === null) {
      return 0;
    }
    inFlightRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await fetchCandles({
        symbol: market.symbol,
        interval: activeInterval,
        to: current[0].openTime - 1,
        limit: candlePageSize(activeInterval),
      });
      const merged = mergeCandles(current, page.candles);
      const added = merged.length - current.length;
      setCandles(merged);
      setHasOlder(page.candles.length > 0 && added > 0 && hasMoreHistory(merged, market));
      return added;
    } catch {
      return 0;
    } finally {
      inFlightRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasOlder]);

  const changeTimeframe = useCallback((next: Timeframe, visibleRange: TimeRangeMs | null) => {
    if (next === intervalRef.current) {
      return;
    }
    setRestoreRange(visibleRange);
    restoreToRef.current = visibleRange?.to ?? null;
    setIntervalState(next);
  }, []);

  return {
    interval,
    info,
    candles,
    status,
    error,
    loadOlder,
    loadingOlder,
    hasOlder,
    changeTimeframe,
    restoreRange,
  };
}

function hasMoreHistory(candles: Candle[], market: MarketInfo): boolean {
  if (candles.length === 0 || market.firstOpenTime === null) {
    return false;
  }
  return candles[0].openTime > market.firstOpenTime;
}
