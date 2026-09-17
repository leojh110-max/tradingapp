import type { Candle, Direction, Timeframe } from "../../types/market";
import { candleDirection } from "../../utils/candles";
import { formatOpenTime, formatPrice, formatVolume } from "../../utils/format";

type Props = {
  candle: Candle | null;
  interval: Timeframe;
};

export function OhlcReadout({ candle, interval }: Props) {
  if (candle === null) {
    return <div className="ohlc-readout ohlc-empty">No data</div>;
  }
  const direction = candleDirection(candle.open, candle.close);
  return (
    <div className={`ohlc-readout ohlc-${direction}`} aria-live="polite">
      <OhlcItem label="Open" value={formatPrice(candle.open)} direction={direction} />
      <OhlcItem label="High" value={formatPrice(candle.high)} direction={direction} />
      <OhlcItem label="Low" value={formatPrice(candle.low)} direction={direction} />
      <OhlcItem label="Close" value={formatPrice(candle.close)} direction={direction} />
      <OhlcItem label="Volume" value={formatVolume(candle.volume)} />
      <span className="ohlc-time">{formatOpenTime(candle.openTime, interval)}</span>
    </div>
  );
}

function OhlcItem({
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
