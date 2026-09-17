import type { Candle, Direction, Timeframe } from "../../types/market";
import { analyzeCandle, formatSignedPercentDisplay } from "../../utils/candleAnalytics";
import { formatOpenTime, formatPrice, formatVolume } from "../../utils/format";

type Props = {
  candle: Candle | null;
  interval: Timeframe;
};

export function ChartInfoBar({ candle, interval }: Props) {
  if (candle === null) {
    return <div className="chart-infobar ohlc-empty">No data</div>;
  }
  const stats = analyzeCandle(candle);
  return (
    <div className={`chart-infobar ohlc-${stats.direction}`} aria-live="polite">
      <InfoItem label="O" value={formatPrice(candle.open)} direction={stats.direction} />
      <InfoItem label="H" value={formatPrice(candle.high)} direction={stats.direction} />
      <InfoItem label="L" value={formatPrice(candle.low)} direction={stats.direction} />
      <InfoItem label="C" value={formatPrice(candle.close)} direction={stats.direction} />
      <InfoItem label="Change" value={stats.changeSigned} direction={stats.direction} />
      <InfoItem
        label="Change %"
        value={formatSignedPercentDisplay(stats.changePercentSigned)}
        direction={stats.direction}
      />
      <InfoItem label="Volume" value={formatVolume(candle.volume)} />
      <span className="ohlc-time">{formatOpenTime(candle.openTime, interval)}</span>
    </div>
  );
}

function InfoItem({
  label,
  value,
  direction,
}: {
  label: string;
  value: string;
  direction?: Direction;
}) {
  return (
    <span className="ohlc-item">
      <span className="ohlc-label">{label}</span>
      <span className={direction ? `ohlc-value ohlc-value-${direction}` : "ohlc-value"}>{value}</span>
    </span>
  );
}
