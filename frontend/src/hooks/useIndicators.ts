import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Candle, Timeframe } from "../types/market";
import { isAbortError } from "../services/api";
import { usePrimaryLoadingVisible } from "../utils/loadingOverlay";
import {
  createInstance,
  maxWarmupPrior,
  removeInstance,
  toggleInstanceVisible,
  updateInstance,
} from "../indicators/instances";
import { loadIndicatorInstances, saveIndicatorInstances } from "../indicators/persistence";
import {
  INDICATOR_CALC_ERROR,
  calculationFingerprint,
  computeWindowOutputs,
  indicatorRequestKey,
  isCurrentIndicatorRequest,
  loadingStatusMessage,
  nextIndicatorRequestId,
  type IndicatorComputation,
} from "../indicators/runtime";
import type { IndicatorInstance } from "../indicators/types";
import { canAddInstance } from "../indicators/validation";
import { fetchWarmupCandles } from "../indicators/warmupLoader";

type Args = {
  symbol: string | null;
  interval: Timeframe;
  candles: Candle[];
  ready: boolean;
  cutoff?: number | null;
};

export function useIndicators({ symbol, interval, candles, ready, cutoff = null }: Args) {
  const [instances, setInstances] = useState<IndicatorInstance[]>(() => loadIndicatorInstances());
  const [computations, setComputations] = useState<IndicatorComputation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const instancesRef = useRef(instances);
  const candlesRef = useRef(candles);
  instancesRef.current = instances;
  candlesRef.current = candles;

  useEffect(() => {
    saveIndicatorInstances(instances);
  }, [instances]);

  const fingerprint = useMemo(() => calculationFingerprint(instances), [instances]);
  const requestKey = indicatorRequestKey({
    interval,
    firstOpenTime: candles[0]?.openTime ?? null,
    lastOpenTime: candles[candles.length - 1]?.openTime ?? null,
    length: candles.length,
    fingerprint,
    cutoff,
  });

  useEffect(() => {
    if (!ready) {
      return;
    }
    const activeInstances = instancesRef.current;
    const displayed = candlesRef.current;
    if (symbol === null || displayed.length === 0 || activeInstances.length === 0) {
      abortRef.current?.abort();
      setComputations([]);
      setLoading(false);
      setError(null);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = nextIndicatorRequestId(requestIdRef.current);
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const prior = maxWarmupPrior(activeInstances);
        const warmup =
          prior > 0
            ? await fetchWarmupCandles({
                symbol,
                interval,
                beforeOpenTime: displayed[0].openTime,
                count: prior,
                cutoff,
                signal: controller.signal,
              })
            : [];
        if (!isCurrentIndicatorRequest(requestIdRef.current, requestId)) {
          return;
        }
        setComputations(computeWindowOutputs(activeInstances, displayed, warmup, cutoff));
      } catch (cause) {
        if (isAbortError(cause) || !isCurrentIndicatorRequest(requestIdRef.current, requestId)) {
          return;
        }
        setError(INDICATOR_CALC_ERROR);
        setComputations(
          activeInstances.map((row) => ({
            output: { instanceId: row.id, series: [] },
            error: INDICATOR_CALC_ERROR,
          })),
        );
      } finally {
        if (isCurrentIndicatorRequest(requestIdRef.current, requestId)) {
          setLoading(false);
        }
      }
    })();
    return () => {
      controller.abort();
    };
  }, [cutoff, interval, ready, requestKey, retryNonce, symbol]);

  const showLoading = usePrimaryLoadingVisible(loading);
  const loadingMessage = showLoading ? loadingStatusMessage(instances) : null;

  const addConfigured = useCallback((draft: Omit<IndicatorInstance, "id">) => {
    const allowed = canAddInstance(instancesRef.current.length);
    if (!allowed.ok) {
      return allowed;
    }
    setInstances((current) => {
      const created = createInstance(draft.type, current);
      return [...current, { ...created, ...draft, id: created.id }];
    });
    return { ok: true as const };
  }, []);

  const editIndicator = useCallback(
    (id: string, patch: Partial<Omit<IndicatorInstance, "id" | "type">>) => {
      setInstances((current) => updateInstance(current, id, patch));
    },
    [],
  );

  const hideToggle = useCallback((id: string) => {
    setInstances((current) => toggleInstanceVisible(current, id));
  }, []);

  const removeIndicator = useCallback((id: string) => {
    setInstances((current) => removeInstance(current, id));
  }, []);

  return {
    instances,
    computations,
    error,
    loading,
    loadingMessage,
    addConfigured,
    editIndicator,
    hideToggle,
    removeIndicator,
    retry: () => setRetryNonce((value) => value + 1),
  };
}
