import { formatCount } from "../../utils/format";
import type { Timeframe } from "../../types/market";

type Props = {
  candleCount: number;
  totalCount: number | null;
  interval: Timeframe;
  overlayInterval: Timeframe;
  historyLabel: string;
};

export function ChartStatusBar({ candleCount, totalCount, interval, overlayInterval, historyLabel }: Props) {
  return (
    <footer className="chart-footer">
      <span>
        Loaded {formatCount(candleCount)} {interval} candles
        {totalCount !== null && interval === "1m" ? ` of ${formatCount(totalCount)}` : ""}
      </span>
      <span>
        Timeframe {overlayInterval}
        {overlayInterval === "1d" ? " (UTC)" : ""}
      </span>
      <span>{historyLabel}</span>
      <span>UTC</span>
      <span>Offline</span>
    </footer>
  );
}
