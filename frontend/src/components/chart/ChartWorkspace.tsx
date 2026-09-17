import { useEffect, useRef, useState } from "react";
import { useMarketData } from "../../hooks/useMarketData";
import type { Candle, Timeframe } from "../../types/market";
import { formatCount } from "../../utils/format";
import type { TimeRangeMs } from "../../utils/timeframes";
import { CandlestickChart } from "./CandlestickChart";
import { ChartHeader } from "./ChartHeader";

export function ChartWorkspace() {
  const {
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
  } = useMarketData();
  const [hovered, setHovered] = useState<Candle | null>(null);
  const visibleRangeRef = useRef<TimeRangeMs | null>(null);

  useEffect(() => {
    if (hovered === null && candles.length > 0 && status === "ready") {
      setHovered(candles[candles.length - 1]);
    }
  }, [candles, hovered, status]);

  const onSelectTimeframe = (next: Timeframe) => {
    setHovered(null);
    changeTimeframe(next, visibleRangeRef.current);
  };

  if (status === "loading" && info === null) {
    return (
      <div className="workspace">
        <div className="workspace-message">Loading...</div>
      </div>
    );
  }
  if (status === "error" || info === null) {
    return (
      <div className="workspace">
        <div className="workspace-message workspace-error">{error ?? "Failed to load market data"}</div>
      </div>
    );
  }

  return (
    <div className="workspace">
      <ChartHeader
        info={info}
        interval={interval}
        hovered={hovered}
        onSelectTimeframe={onSelectTimeframe}
      />
      <div className="chart-stage">
        {status === "loading" || candles.length === 0 ? (
          <div className="workspace-message">{status === "loading" ? "Loading..." : "No data"}</div>
        ) : (
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
        )}
      </div>
      <footer className="chart-footer">
        <span>
          Loaded {formatCount(candles.length)} {interval} candles
          {interval === "1m" ? ` of ${formatCount(info.candleCount)}` : ""}
        </span>
        <span>Timeframe {interval}{interval === "1d" ? " (UTC)" : ""}</span>
        <span>{loadingOlder ? "Loading history..." : hasOlder ? "Pan left for older candles" : "Start of history"}</span>
        <span>Offline</span>
      </footer>
    </div>
  );
}
