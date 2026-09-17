export const INDICATOR_PERIOD_MIN = 1;
export const INDICATOR_PERIOD_MAX = 5000;
export const INDICATOR_INSTANCE_LIMIT = 20;
export const INDICATOR_LINE_WIDTH_MIN = 1;
export const INDICATOR_LINE_WIDTH_MAX = 4;
export const EMA_SEED_WEIGHT_EPSILON = 1e-8;
export const EMA_GUARD_DIGITS = 12;
export const INDICATORS_STORAGE_KEY = "chart.indicators.v1";

export const INDICATOR_SOURCES = ["close", "open", "high", "low"] as const;
export type IndicatorSource = (typeof INDICATOR_SOURCES)[number];

export const INDICATOR_TYPES = ["sma", "ema", "rsi", "macd"] as const;
export type IndicatorTypeId = (typeof INDICATOR_TYPES)[number];

export type IndicatorPlacement = "overlay" | "pane";
export type IndicatorValueKind = "price" | "oscillator" | "percentage" | "priceDelta" | "generic";
export type IndicatorRenderType = "line" | "histogram";
export type IndicatorPaneScaleMode = "fixed" | "auto";

export const MACD_DEFAULT_SIGNAL_COLOR = "#fb923c";
export const MACD_DEFAULT_HIST_POSITIVE = "#2dd4bf";
export const MACD_DEFAULT_HIST_NEGATIVE = "#a78bfa";
export const MACD_HIST_ZERO_COLOR = "#64748b";

export type IndicatorSettings = {
  period: number;
  source: IndicatorSource;
  color: string;
  lineWidth: number;
  visible: boolean;
  overbought?: number;
  oversold?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  signalColor?: string;
  histogramPositiveColor?: string;
  histogramNegativeColor?: string;
};

export type IndicatorInstance = {
  id: string;
  type: IndicatorTypeId;
} & IndicatorSettings;

export type IndicatorPoint = {
  openTime: number;
  value: string;
};

export type IndicatorSeriesOutput = {
  key: string;
  title: string;
  points: IndicatorPoint[];
  renderType: IndicatorRenderType;
  valueKind: IndicatorValueKind;
};

export type IndicatorOutput = {
  instanceId: string;
  series: IndicatorSeriesOutput[];
};

export type IndicatorSample = {
  openTime: number;
  source: string;
};

export type IndicatorPaneLevel = {
  price: number;
  label: string;
  emphasis: "strong" | "mid";
};

export type IndicatorPaneScale = {
  mode: IndicatorPaneScaleMode;
  min?: number;
  max?: number;
  includeZero?: boolean;
};

export type IndicatorDefinition = {
  id: IndicatorTypeId;
  name: string;
  shortName: string;
  category: string;
  placement: IndicatorPlacement;
  paneGroup: string | null;
  paneOrder: number;
  valueKind: IndicatorValueKind;
  renderType: IndicatorRenderType;
  paneScale?: IndicatorPaneScale;
  supportedSources: readonly IndicatorSource[];
  defaultSettings: Omit<IndicatorSettings, "color" | "visible">;
  warmupPrior: (instance: IndicatorInstance) => number;
  calculator: (samples: IndicatorSample[], instance: IndicatorInstance) => IndicatorSeriesOutput[];
  label: (instance: IndicatorInstance) => string;
  referenceLevels?: (instance: IndicatorInstance) => IndicatorPaneLevel[];
};

export type IndicatorOverlayLine = {
  id: string;
  color: string;
  lineWidth: number;
  visible: boolean;
  points: { openTime: number; value: string }[];
};

export type IndicatorPaneLine = {
  id: string;
  instanceId: string;
  seriesKey: string;
  paneGroup: string;
  renderType: IndicatorRenderType;
  color: string;
  histogramPositiveColor?: string;
  histogramNegativeColor?: string;
  histogramZeroColor?: string;
  lineWidth: number;
  visible: boolean;
  points: { openTime: number; value: string }[];
  scaleMode: IndicatorPaneScaleMode;
  scaleMin?: number;
  scaleMax?: number;
  levels: IndicatorPaneLevel[];
};

export const INDICATOR_COLOR_PALETTE = [
  "#f5c542",
  "#5b9dff",
  "#c084fc",
  "#22d3ee",
  "#fb923c",
  "#e879f9",
  "#94a3b8",
  "#2dd4bf",
] as const;
