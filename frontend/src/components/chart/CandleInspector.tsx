import type { Candle, Timeframe } from "../../types/market";
import { analyzeCandle, formatPercentDisplay, formatSignedPercentDisplay } from "../../utils/candleAnalytics";
import { formatOpenTime, formatPrice, formatVolume } from "../../utils/format";
import { IconClose } from "./ChartIcons";

type Props = {
  candle: Candle | null;
  interval: Timeframe;
  onClose: () => void;
};

export function CandleInspector({ candle, interval, onClose }: Props) {
  return (
    <aside className="candle-inspector" aria-label="Candle Inspector">
      <div className="inspector-header">
        <h2>Candle Inspector</h2>
        <button type="button" className="icon-btn" aria-label="Close Inspector" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      {candle === null ? (
        <p className="inspector-empty">Click a candle to inspect it.</p>
      ) : (
        <InspectorBody candle={candle} interval={interval} />
      )}
    </aside>
  );
}

function InspectorBody({ candle, interval }: { candle: Candle; interval: Timeframe }) {
  const stats = analyzeCandle(candle);
  const showQuality = candle.sourceCandleCount !== undefined && interval !== "1m";
  return (
    <div className="inspector-body">
      <InspectorRow label="Time" value={formatOpenTime(candle.openTime, interval)} />
      <InspectorRow label="Open" value={formatPrice(candle.open)} />
      <InspectorRow label="High" value={formatPrice(candle.high)} />
      <InspectorRow label="Low" value={formatPrice(candle.low)} />
      <InspectorRow label="Close" value={formatPrice(candle.close)} />
      <InspectorRow label="Change" value={stats.changeSigned} tone={stats.direction} />
      <InspectorRow
        label="Change %"
        value={formatSignedPercentDisplay(stats.changePercentSigned)}
        tone={stats.direction}
      />
      <InspectorRow label="Range" value={stats.range} />
      <InspectorRow label="Body" value={stats.body} />
      <InspectorRow label="Upper Wick" value={stats.upperWick} />
      <InspectorRow label="Lower Wick" value={stats.lowerWick} />
      <InspectorRow label="Body / Range" value={formatPercentDisplay(stats.bodyPercent)} />
      <InspectorRow label="Upper Wick / Range" value={formatPercentDisplay(stats.upperWickPercent)} />
      <InspectorRow label="Lower Wick / Range" value={formatPercentDisplay(stats.lowerWickPercent)} />
      <InspectorRow label="Volume" value={formatVolume(candle.volume)} />
      <InspectorRow label="Direction" value={stats.directionLabel} tone={stats.direction} />
      {showQuality ? (
        <section className="inspector-quality">
          <h3>Data Quality</h3>
          <InspectorRow
            label="Source candles"
            value={`${candle.sourceCandleCount ?? "—"} / ${candle.expectedCandleCount ?? "—"}`}
          />
          <InspectorRow label="Status" value={candle.complete ? "Complete" : "Incomplete"} />
        </section>
      ) : null}
    </div>
  );
}

function InspectorRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="inspector-row">
      <span className="inspector-label">{label}</span>
      <span className={tone ? `inspector-value ohlc-value-${tone}` : "inspector-value"}>{value}</span>
    </div>
  );
}
