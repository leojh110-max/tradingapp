import type { Candle, MarketInfo, Timeframe } from "../../types/market";
import { marketLabel, symbolLabel } from "../../utils/format";
import { OhlcReadout } from "./OhlcReadout";
import { TimeframeBar } from "./TimeframeBar";

type Props = {
  info: MarketInfo;
  interval: Timeframe;
  hovered: Candle | null;
  onSelectTimeframe: (timeframe: Timeframe) => void;
};

export function ChartHeader({ info, interval, hovered, onSelectTimeframe }: Props) {
  return (
    <header className="chart-header">
      <div className="chart-identity">
        <h1 className="symbol-title">{symbolLabel(info.baseAsset, info.quoteAsset)}</h1>
        <span className="market-pill">{marketLabel(info.market)}</span>
        <span className="exchange-pill">{info.exchange}</span>
      </div>
      <TimeframeBar active={interval} onSelect={onSelectTimeframe} />
      <OhlcReadout candle={hovered} interval={interval} />
    </header>
  );
}
