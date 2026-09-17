import { applyCutoff, samplesFromCandles } from "./sources";
import { getIndicatorDefinition } from "./registry";
import type { Candle } from "../types/market";
import type { IndicatorInstance, IndicatorOutput, IndicatorSeriesOutput } from "./types";

export function computeInstance(
  instance: IndicatorInstance,
  candles: Candle[],
  cutoff: number | null = null,
): IndicatorOutput {
  const definition = getIndicatorDefinition(instance.type);
  if (!definition) {
    return { instanceId: instance.id, series: [] };
  }
  const allowed = applyCutoff(candles, cutoff);
  const samples = samplesFromCandles(allowed, instance.source);
  const series = definition.calculator(samples, instance).map((row) => ({
    ...row,
    points: row.points.filter((point) => (cutoff === null ? true : point.openTime <= cutoff)),
  }));
  return { instanceId: instance.id, series };
}

export function sliceOutputToWindow(output: IndicatorOutput, displayedOpenTimes: Set<number>): IndicatorOutput {
  return {
    instanceId: output.instanceId,
    series: output.series.map((series) => ({
      ...series,
      points: series.points.filter((point) => displayedOpenTimes.has(point.openTime)),
    })),
  };
}

export function valueAtTime(output: IndicatorOutput, openTime: number, seriesKey?: string): string | null {
  const series = seriesKey ? output.series.find((row) => row.key === seriesKey) : output.series[0];
  if (!series) {
    return null;
  }
  const point = series.points.find((row) => row.openTime === openTime);
  return point?.value ?? null;
}

export function seriesValuesAtTime(
  output: IndicatorOutput,
  openTime: number,
): Array<Pick<IndicatorSeriesOutput, "key" | "title" | "valueKind"> & { value: string | null }> {
  return output.series.map((series) => ({
    key: series.key,
    title: series.title,
    valueKind: series.valueKind,
    value: series.points.find((row) => row.openTime === openTime)?.value ?? null,
  }));
}
