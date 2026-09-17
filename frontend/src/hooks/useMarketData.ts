import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCandles, fetchMarketInfo, isAbortError } from "../services/api";
import type { Candle, MarketInfo, Timeframe } from "../types/market";
import { mergeCandles } from "../utils/candles";
import { CHART_LOAD_ERROR, usePrimaryLoadingVisible } from "../utils/loadingOverlay";
import { nextRequestId } from "../utils/requestIdentity";
import { candlePageSize, type TimeRangeMs } from "../utils/timeframes";

type Status = "loading" | "ready" | "error";

export function useMarketData() {
  const [interval, setIntervalState] = useState<Timeframe>("1m");
  const [pendingInterval, setPendingInterval] = useState<Timeframe | null>("1m");
  const [info, setInfo] = useState<MarketInfo | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(true);
  const [restoreRange, setRestoreRange] = useState<TimeRangeMs | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const infoRef = useRef<MarketInfo | null>(null);
  const intervalRef = useRef<Timeframe>(interval);
  const inFlightRef = useRef(false);
  const restoreToRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const olderAbortRef = useRef<AbortController | null>(null);

  candlesRef.current = candles;
  infoRef.current = info;
  intervalRef.current = interval;

  const showPrimaryOverlay = usePrimaryLoadingVisible(status === "loading" && error === null);

  const loadTimeframe = useCallback(async (next: Timeframe) => {
    olderAbortRef.current?.abort();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = nextRequestId(requestIdRef.current);
    requestIdRef.current = requestId;
    setPendingInterval(next);
    setStatus("loading");
    setError(null);
    setOlderError(null);
    setHasOlder(true);
    setLoadingOlder(false);
    inFlightRef.current = false;
    try {
      const market = await fetchMarketInfo(next, controller.signal);
      const to = restoreToRef.current ?? undefined;
      restoreToRef.current = null;
      const page = await fetchCandles(
        {
          symbol: market.symbol,
          interval: next,
          to,
          limit: candlePageSize(next),
        },
        controller.signal,
      );
      if (requestId !== requestIdRef.current) {
        return;
      }
      setInfo(market);
      setCandles(page.candles);
      setIntervalState(next);
      setHasOlder(hasMoreHistory(page.candles, market));
      setPendingInterval(null);
      setStatus("ready");
    } catch (cause) {
      if (isAbortError(cause) || requestId !== requestIdRef.current) {
        return;
      }
      setError(CHART_LOAD_ERROR);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadTimeframe("1m");
    return () => {
      abortRef.current?.abort();
      olderAbortRef.current?.abort();
    };
  }, [loadTimeframe]);

  const retry = useCallback(() => {
    void loadTimeframe(pendingInterval ?? intervalRef.current);
  }, [loadTimeframe, pendingInterval]);

  const loadOlder = useCallback(async (): Promise<number> => {
    const current = candlesRef.current;
    const market = infoRef.current;
    const activeInterval = intervalRef.current;
    if (inFlightRef.current || !hasOlder || current.length === 0 || market === null || pendingInterval !== null) {
      return 0;
    }
    olderAbortRef.current?.abort();
    const controller = new AbortController();
    olderAbortRef.current = controller;
    inFlightRef.current = true;
    setLoadingOlder(true);
    setOlderError(null);
    try {
      const page = await fetchCandles(
        {
          symbol: market.symbol,
          interval: activeInterval,
          to: current[0].openTime - 1,
          limit: candlePageSize(activeInterval),
        },
        controller.signal,
      );
      if (intervalRef.current !== activeInterval) {
        return 0;
      }
      const merged = mergeCandles(current, page.candles);
      const added = merged.length - current.length;
      setCandles(merged);
      setHasOlder(page.candles.length > 0 && added > 0 && hasMoreHistory(merged, market));
      return added;
    } catch (cause) {
      if (!isAbortError(cause)) {
        setOlderError(CHART_LOAD_ERROR);
      }
      return 0;
    } finally {
      inFlightRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasOlder, pendingInterval]);

  const changeTimeframe = useCallback(
    (next: Timeframe, visibleRange: TimeRangeMs | null) => {
      if (next === intervalRef.current && pendingInterval === null) {
        return;
      }
      setRestoreRange(visibleRange);
      restoreToRef.current = visibleRange?.to ?? null;
      void loadTimeframe(next);
    },
    [loadTimeframe, pendingInterval],
  );

  return {
    interval,
    pendingInterval,
    info,
    candles,
    status,
    error,
    retry,
    loadOlder,
    loadingOlder,
    olderError,
    hasOlder,
    changeTimeframe,
    restoreRange,
    showPrimaryOverlay,
  };
}

function hasMoreHistory(candles: Candle[], market: MarketInfo): boolean {
  if (candles.length === 0 || market.firstOpenTime === null) {
    return false;
  }
  return candles[0].openTime > market.firstOpenTime;
}
