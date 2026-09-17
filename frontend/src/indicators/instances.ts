import { mergeCandles } from "../utils/candles";
import type { Candle } from "../types/market";
import { INDICATOR_COLOR_PALETTE, type IndicatorInstance, type IndicatorTypeId } from "./types";
import { getIndicatorDefinition } from "./registry";

export function nextIndicatorColor(existingCount: number): string {
  return INDICATOR_COLOR_PALETTE[existingCount % INDICATOR_COLOR_PALETTE.length];
}

export function createInstance(type: IndicatorTypeId, existing: IndicatorInstance[]): IndicatorInstance {
  const definition = getIndicatorDefinition(type);
  if (!definition) {
    throw new Error(`Unknown indicator: ${type}`);
  }
  return {
    id: `ind_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    ...definition.defaultSettings,
    color: nextIndicatorColor(existing.length),
    visible: true,
  };
}

export function maxWarmupPrior(instances: IndicatorInstance[]): number {
  return instances.reduce((max, instance) => {
    const definition = getIndicatorDefinition(instance.type);
    return Math.max(max, definition?.warmupPrior(instance) ?? 0);
  }, 0);
}

export function calculationCandles(displayed: Candle[], warmup: Candle[]): Candle[] {
  return mergeCandles(warmup, displayed);
}

export function instanceLabel(instance: IndicatorInstance): string {
  const definition = getIndicatorDefinition(instance.type);
  if (definition) {
    return definition.label(instance);
  }
  return `${instance.type.toUpperCase()} ${instance.period} ${instance.source}`;
}

export function updateInstance(
  instances: IndicatorInstance[],
  id: string,
  patch: Partial<Omit<IndicatorInstance, "id" | "type">>,
): IndicatorInstance[] {
  return instances.map((instance) => (instance.id === id ? { ...instance, ...patch } : instance));
}

export function removeInstance(instances: IndicatorInstance[], id: string): IndicatorInstance[] {
  return instances.filter((instance) => instance.id !== id);
}

export function toggleInstanceVisible(instances: IndicatorInstance[], id: string): IndicatorInstance[] {
  return instances.map((instance) =>
    instance.id === id ? { ...instance, visible: !instance.visible } : instance,
  );
}
