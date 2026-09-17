import { getIndicatorDefinition, paneOrderFor } from "./registry";
import {
  MACD_DEFAULT_HIST_NEGATIVE,
  MACD_DEFAULT_HIST_POSITIVE,
  MACD_DEFAULT_SIGNAL_COLOR,
  MACD_HIST_ZERO_COLOR,
  type IndicatorInstance,
  type IndicatorOverlayLine,
  type IndicatorPaneLevel,
  type IndicatorPaneLine,
  type IndicatorSeriesOutput,
} from "./types";
import type { IndicatorComputation } from "./runtime";

export const MAIN_PANE_STRETCH_WITH_PANES = 0.78;
export const SINGLE_PANE_STRETCH = 0.22;
export const MULTI_PANE_REMAINING = 0.38;
export const MAIN_PANE_STRETCH_MIN = 0.55;

export function paneStretchFactor(paneCount: number): number {
  if (paneCount <= 0) {
    return 0;
  }
  if (paneCount === 1) {
    return SINGLE_PANE_STRETCH;
  }
  return MULTI_PANE_REMAINING / paneCount;
}

export function orderedPaneGroups(groups: Iterable<string>): string[] {
  return [...new Set(groups)].sort((left, right) => {
    const order = paneOrderFor(left) - paneOrderFor(right);
    return order !== 0 ? order : left.localeCompare(right);
  });
}

export function paneGroupOf(instance: IndicatorInstance): string | null {
  return getIndicatorDefinition(instance.type)?.paneGroup ?? null;
}

export function visiblePaneGroups(instances: IndicatorInstance[]): string[] {
  const groups: string[] = [];
  for (const instance of instances) {
    if (!instance.visible) {
      continue;
    }
    const group = paneGroupOf(instance);
    if (group && !groups.includes(group)) {
      groups.push(group);
    }
  }
  return orderedPaneGroups(groups);
}

export function overlayChartLines(
  instances: IndicatorInstance[],
  computations: IndicatorComputation[],
): IndicatorOverlayLine[] {
  const byId = new Map(computations.map((row) => [row.output.instanceId, row]));
  return instances
    .filter((instance) => getIndicatorDefinition(instance.type)?.placement === "overlay")
    .map((instance) => {
      const run = byId.get(instance.id);
      return {
        id: instance.id,
        color: instance.color,
        lineWidth: instance.lineWidth,
        visible: instance.visible && !run?.error,
        points: run?.output.series[0]?.points ?? [],
      };
    });
}

export function paneChartLines(
  instances: IndicatorInstance[],
  computations: IndicatorComputation[],
): IndicatorPaneLine[] {
  const byId = new Map(computations.map((row) => [row.output.instanceId, row]));
  const rows: IndicatorPaneLine[] = [];
  for (const instance of instances) {
    if (!instance.visible) {
      continue;
    }
    const definition = getIndicatorDefinition(instance.type);
    if (definition?.placement !== "pane") {
      continue;
    }
    const run = byId.get(instance.id);
    const group = definition.paneGroup ?? instance.type;
    const seriesList = sortPaneSeries(run?.output.series ?? []);
    const levels = definition.referenceLevels?.(instance) ?? [];
    for (const series of seriesList) {
      rows.push({
        id: `${instance.id}:${series.key}`,
        instanceId: instance.id,
        seriesKey: series.key,
        paneGroup: group,
        renderType: series.renderType,
        color: seriesColor(instance, series.key),
        histogramPositiveColor: instance.histogramPositiveColor ?? MACD_DEFAULT_HIST_POSITIVE,
        histogramNegativeColor: instance.histogramNegativeColor ?? MACD_DEFAULT_HIST_NEGATIVE,
        histogramZeroColor: MACD_HIST_ZERO_COLOR,
        lineWidth: instance.lineWidth,
        visible: !run?.error,
        points: series.points,
        scaleMode: definition.paneScale?.mode ?? "auto",
        scaleMin: definition.paneScale?.mode === "fixed" ? definition.paneScale.min : undefined,
        scaleMax: definition.paneScale?.mode === "fixed" ? definition.paneScale.max : undefined,
        levels,
      });
    }
  }
  return applySharedPaneScales(rows, instances);
}

function sortPaneSeries(series: IndicatorSeriesOutput[]): IndicatorSeriesOutput[] {
  return [...series].sort((left, right) => {
    if (left.renderType === right.renderType) {
      return 0;
    }
    return left.renderType === "histogram" ? -1 : 1;
  });
}

function seriesColor(instance: IndicatorInstance, seriesKey: string): string {
  if (seriesKey === "signal") {
    return instance.signalColor ?? MACD_DEFAULT_SIGNAL_COLOR;
  }
  if (seriesKey === "histogram") {
    return instance.histogramPositiveColor ?? MACD_DEFAULT_HIST_POSITIVE;
  }
  return instance.color;
}

function applySharedPaneScales(rows: IndicatorPaneLine[], instances: IndicatorInstance[]): IndicatorPaneLine[] {
  const groups = new Map<string, IndicatorPaneLine[]>();
  for (const row of rows) {
    const list = groups.get(row.paneGroup) ?? [];
    list.push(row);
    groups.set(row.paneGroup, list);
  }
  const next = [...rows];
  for (const [group, lines] of groups) {
    if (lines.every((line) => line.scaleMode === "fixed")) {
      continue;
    }
    const includeZero = instances.some((instance) => {
      const definition = getIndicatorDefinition(instance.type);
      return definition?.paneGroup === group && definition.paneScale?.includeZero;
    });
    const range = autoScaleRange(
      lines.flatMap((line) => line.points.map((point) => point.value)),
      includeZero,
    );
    for (const line of lines) {
      const index = next.findIndex((row) => row.id === line.id);
      if (index >= 0) {
        next[index] = { ...next[index], scaleMin: range.min, scaleMax: range.max };
      }
    }
  }
  return next;
}

export function autoScaleRange(values: string[], includeZero: boolean): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      continue;
    }
    min = Math.min(min, numeric);
    max = Math.max(max, numeric);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return includeZero ? { min: -1, max: 1 } : { min: 0, max: 1 };
  }
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

export function referenceLevelsFor(instance: IndicatorInstance): IndicatorPaneLevel[] {
  return getIndicatorDefinition(instance.type)?.referenceLevels?.(instance) ?? [];
}

export function uniqueLevels(lines: IndicatorPaneLine[]): IndicatorPaneLevel[] {
  const seen = new Set<number>();
  const levels: IndicatorPaneLevel[] = [];
  for (const line of lines) {
    for (const level of line.levels) {
      if (seen.has(level.price)) {
        continue;
      }
      seen.add(level.price);
      levels.push(level);
    }
  }
  return levels;
}

export function mainStretchFactor(activeGroups: string[]): number {
  if (activeGroups.length === 0) {
    return 1;
  }
  const paneShare = paneStretchFactor(activeGroups.length) * activeGroups.length;
  return Math.max(MAIN_PANE_STRETCH_MIN, 1 - paneShare);
}
