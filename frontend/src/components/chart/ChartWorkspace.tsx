import { useEffect, useRef, useState } from "react";
import { useMarketData } from "../../hooks/useMarketData";
import type { Candle, Timeframe } from "../../types/market";
import { formatCount } from "../../utils/format";
import { CHART_LOAD_ERROR } from "../../utils/loadingOverlay";
import type { TimeRangeMs } from "../../utils/timeframes";
import { CandlestickChart } from "./CandlestickChart";
import { ChartErrorPanel } from "./ChartErrorPanel";
import { ChartHeader } from "./ChartHeader";
import { HistoricalLoadingIndicator } from "./HistoricalLoadingIndicator";
import { PrimaryLoadingOverlay } from "./PrimaryLoadingOverlay";

export function ChartWorkspace() {
  const {
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
  } = useMarketData();
  const [hovered, setHovered] = useState<Candle | null>(null);
  const visibleRangeRef = useRef<TimeRangeMs | null>(null);
  const overlayInterval = pendingInterval ?? interval;

  useEffect(() => {
    if (hovered === null && candles.length > 0 && status === "ready") {
      setHovered(candles[candles.length - 1]);
    }
  }, [candles, hovered, status]);

  const onSelectTimeframe = (next: Timeframe) => {
    setHovered(null);
    changeTimeframe(next, visibleRangeRef.current);
  };

  const historyLabel = loadingOlder
    ? "Loading older candles..."
    : olderError
      ? olderError
      : hasOlder
        ? "Pan left for older candles"
        : "Start of history";

  return (
    <div className="workspace">
      {info !== null ? (
        <ChartHeader
          info={info}
          interval={interval}
          pendingInterval={status === "loading" ? pendingInterval : null}
          hovered={hovered}
          onSelectTimeframe={onSelectTimeframe}
        />
      ) : (
        <header className="chart-header">
          <div className="chart-identity">
            <h1 className="symbol-title">BTC / USDT</h1>
          </div>
        </header>
      )}
      <div className="chart-stage">
        {candles.length > 0 ? (
          <CandlestickChart
            key={interval}
            candles={candles}
            interval={interval}
            initialTimeRange={restoreRange}
            onHover={setHovered}
            onNeedOlder={() => {
              void loadOlder();
            }}
            onVisibleTimeRangeChange={(range) => {
              visibleRangeRef.current = range;
            }}
            loadingOlder={loadingOlder}
          />
        ) : null}
        {showPrimaryOverlay ? <PrimaryLoadingOverlay interval={overlayInterval} /> : null}
        {status === "error" ? <ChartErrorPanel message={error ?? CHART_LOAD_ERROR} onRetry={retry} /> : null}
        {loadingOlder ? <HistoricalLoadingIndicator /> : null}
      </div>
      <footer className="chart-footer">
        <span>
          Loaded {formatCount(candles.length)} {interval} candles
          {info !== null && interval === "1m" ? ` of ${formatCount(info.candleCount)}` : ""}
        </span>
        <span>
          Timeframe {overlayInterval}
          {overlayInterval === "1d" ? " (UTC)" : ""}
        </span>
        <span>{historyLabel}</span>
        <span>Offline</span>
      </footer>
    </div>
  );
}
