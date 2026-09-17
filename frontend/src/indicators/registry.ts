import { calculateEma } from "./movingAverage/ema";
import { calculateSma } from "./movingAverage/sma";
import { macdSeriesOutputs } from "./oscillators/macd";
import { calculateRsi } from "./oscillators/rsi";
import type {
  IndicatorDefinition,
  IndicatorInstance,
  IndicatorPaneLevel,
  IndicatorPoint,
  IndicatorSample,
  IndicatorSeriesOutput,
} from "./types";
import {
  MACD_DEFAULT_HIST_NEGATIVE,
  MACD_DEFAULT_HIST_POSITIVE,
  MACD_DEFAULT_SIGNAL_COLOR,
} from "./types";
import { emaWarmupPrior, macdWarmupPrior, rsiWarmupPrior, smaWarmupPrior } from "./warmup";

function singleLineSeries(
  key: string,
  title: string,
  points: IndicatorPoint[],
  valueKind: IndicatorSeriesOutput["valueKind"],
): IndicatorSeriesOutput[] {
  return [{ key, title, points, renderType: "line", valueKind }];
}

function overlayLabel(shortName: string, instance: IndicatorInstance): string {
  return `${shortName} ${instance.period} ${instance.source}`;
}

function rsiLevels(instance: IndicatorInstance): IndicatorPaneLevel[] {
  const overbought = instance.overbought ?? 70;
  const oversold = instance.oversold ?? 30;
  const levels: IndicatorPaneLevel[] = [
    { price: overbought, label: String(overbought), emphasis: "strong" },
    { price: oversold, label: String(oversold), emphasis: "strong" },
  ];
  if (overbought !== 50 && oversold !== 50) {
    levels.push({ price: 50, label: "50", emphasis: "mid" });
  }
  return levels;
}

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = {
  sma: {
    id: "sma",
    name: "Simple Moving Average",
    shortName: "SMA",
    category: "Moving Averages",
    placement: "overlay",
    paneGroup: null,
    paneOrder: 0,
    valueKind: "price",
    renderType: "line",
    supportedSources: ["close", "open", "high", "low"],
    defaultSettings: { period: 20, source: "close", lineWidth: 2 },
    warmupPrior: (instance) => smaWarmupPrior(instance.period),
    calculator: (samples: IndicatorSample[], instance) =>
      singleLineSeries("value", overlayLabel("SMA", instance), calculateSma(samples, instance.period), "price"),
    label: (instance) => overlayLabel("SMA", instance),
  },
  ema: {
    id: "ema",
    name: "Exponential Moving Average",
    shortName: "EMA",
    category: "Moving Averages",
    placement: "overlay",
    paneGroup: null,
    paneOrder: 0,
    valueKind: "price",
    renderType: "line",
    supportedSources: ["close", "open", "high", "low"],
    defaultSettings: { period: 20, source: "close", lineWidth: 2 },
    warmupPrior: (instance) => emaWarmupPrior(instance.period),
    calculator: (samples: IndicatorSample[], instance) =>
      singleLineSeries("value", overlayLabel("EMA", instance), calculateEma(samples, instance.period), "price"),
    label: (instance) => overlayLabel("EMA", instance),
  },
  rsi: {
    id: "rsi",
    name: "Relative Strength Index",
    shortName: "RSI",
    category: "Oscillators",
    placement: "pane",
    paneGroup: "rsi",
    paneOrder: 10,
    valueKind: "oscillator",
    renderType: "line",
    paneScale: { mode: "fixed", min: 0, max: 100 },
    supportedSources: ["close", "open", "high", "low"],
    defaultSettings: { period: 14, source: "close", lineWidth: 2, overbought: 70, oversold: 30 },
    warmupPrior: (instance) => rsiWarmupPrior(instance.period),
    calculator: (samples: IndicatorSample[], instance) =>
      singleLineSeries("value", overlayLabel("RSI", instance), calculateRsi(samples, instance.period), "oscillator"),
    label: (instance) => overlayLabel("RSI", instance),
    referenceLevels: rsiLevels,
  },
  macd: {
    id: "macd",
    name: "Moving Average Convergence Divergence",
    shortName: "MACD",
    category: "Oscillators",
    placement: "pane",
    paneGroup: "macd",
    paneOrder: 20,
    valueKind: "priceDelta",
    renderType: "line",
    paneScale: { mode: "auto", includeZero: true },
    supportedSources: ["close", "open", "high", "low"],
    defaultSettings: {
      period: 26,
      source: "close",
      lineWidth: 2,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      signalColor: MACD_DEFAULT_SIGNAL_COLOR,
      histogramPositiveColor: MACD_DEFAULT_HIST_POSITIVE,
      histogramNegativeColor: MACD_DEFAULT_HIST_NEGATIVE,
    },
    warmupPrior: (instance) =>
      macdWarmupPrior(instance.fastPeriod ?? 12, instance.slowPeriod ?? instance.period, instance.signalPeriod ?? 9),
    calculator: (samples, instance) =>
      macdSeriesOutputs(
        samples,
        instance.fastPeriod ?? 12,
        instance.slowPeriod ?? instance.period,
        instance.signalPeriod ?? 9,
      ),
    label: (instance) =>
      `MACD ${instance.fastPeriod ?? 12} ${instance.slowPeriod ?? instance.period} ${instance.signalPeriod ?? 9}`,
    referenceLevels: () => [{ price: 0, label: "0", emphasis: "mid" }],
  },
};

export function getIndicatorDefinition(type: string): IndicatorDefinition | null {
  return INDICATOR_REGISTRY[type] ?? null;
}

export function listIndicatorDefinitions(): IndicatorDefinition[] {
  return Object.values(INDICATOR_REGISTRY);
}

export function paneOrderFor(group: string): number {
  const definition = listIndicatorDefinitions().find((row) => row.paneGroup === group);
  return definition?.paneOrder ?? 100;
}
