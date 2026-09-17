import type { MarketInfo, Timeframe } from "../../types/market";
import type { ChartSettings, ChartType } from "../../utils/chartSettings";
import { marketLabel, symbolLabel } from "../../utils/format";
import {
  IconArea,
  IconAutoScale,
  IconBar,
  IconCalendar,
  IconCandles,
  IconFullscreen,
  IconInspector,
  IconLatest,
  IconLine,
  IconLogScale,
  IconReset,
  IconSettings,
} from "./ChartIcons";
import { IconButton } from "./IconButton";
import { TimeframeBar } from "./TimeframeBar";

type Props = {
  info: MarketInfo | null;
  interval: Timeframe;
  pendingInterval: Timeframe | null;
  settings: ChartSettings;
  fullscreen: boolean;
  inspectorOpen: boolean;
  onSelectTimeframe: (timeframe: Timeframe) => void;
  onChartType: (chartType: ChartType) => void;
  onGoToDate: () => void;
  onGoToLatest: () => void;
  onAutoScale: () => void;
  onToggleLogScale: () => void;
  onResetView: () => void;
  onSettings: () => void;
  onToggleInspector: () => void;
  onToggleFullscreen: () => void;
};

const CHART_TYPE_BUTTONS: { type: ChartType; label: string; icon: typeof IconCandles }[] = [
  { type: "candles", label: "Candles", icon: IconCandles },
  { type: "bar", label: "Bar", icon: IconBar },
  { type: "line", label: "Line", icon: IconLine },
  { type: "area", label: "Area", icon: IconArea },
];

export function ChartToolbar({
  info,
  interval,
  pendingInterval,
  settings,
  fullscreen,
  inspectorOpen,
  onSelectTimeframe,
  onChartType,
  onGoToDate,
  onGoToLatest,
  onAutoScale,
  onToggleLogScale,
  onResetView,
  onSettings,
  onToggleInspector,
  onToggleFullscreen,
}: Props) {
  return (
    <header className="chart-toolbar">
      <div className="toolbar-group toolbar-market">
        <h1 className="symbol-title">{info ? symbolLabel(info.baseAsset, info.quoteAsset) : "BTC/USDT"}</h1>
        <span className="market-pill">{info ? marketLabel(info.market) : "Spot"}</span>
        <span className="exchange-pill">{info ? info.exchange : "binance"}</span>
      </div>
      <TimeframeBar active={interval} pending={pendingInterval} onSelect={onSelectTimeframe} />
      <div className="toolbar-group" role="group" aria-label="Chart type">
        {CHART_TYPE_BUTTONS.map(({ type, label, icon: Icon }) => (
          <IconButton
            key={type}
            label={label}
            active={settings.chartType === type}
            onClick={() => onChartType(type)}
          >
            <Icon />
          </IconButton>
        ))}
      </div>
      <div className="toolbar-group" role="group" aria-label="Navigation">
        <IconButton label="Go to Date" shortcut="G" onClick={onGoToDate}>
          <IconCalendar />
        </IconButton>
        <IconButton label="Go to Latest" shortcut="L" onClick={onGoToLatest}>
          <IconLatest />
        </IconButton>
        <IconButton label="Reset View" shortcut="R" onClick={onResetView}>
          <IconReset />
        </IconButton>
      </div>
      <div className="toolbar-group toolbar-controls" role="group" aria-label="Chart controls">
        <IconButton label="Auto Scale" active={settings.autoScale} onClick={onAutoScale}>
          <IconAutoScale />
        </IconButton>
        <IconButton label="Log Scale" active={settings.logScale} onClick={onToggleLogScale}>
          <IconLogScale />
        </IconButton>
        <IconButton label="Candle Inspector" active={inspectorOpen} onClick={onToggleInspector}>
          <IconInspector />
        </IconButton>
        <IconButton label="Chart Settings" onClick={onSettings}>
          <IconSettings />
        </IconButton>
        <IconButton
          label={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          shortcut="F"
          active={fullscreen}
          onClick={onToggleFullscreen}
        >
          <IconFullscreen />
        </IconButton>
      </div>
    </header>
  );
}
