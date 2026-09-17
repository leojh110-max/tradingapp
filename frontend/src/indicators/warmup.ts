import { EMA_SEED_WEIGHT_EPSILON, type IndicatorInstance } from "./types";

export function smaWarmupPrior(period: number): number {
  return Math.max(0, period - 1);
}

export function emaWarmupExtra(period: number): number {
  if (period <= 1) {
    return 0;
  }
  const decay = (period - 1) / (period + 1);
  return Math.ceil(Math.log(EMA_SEED_WEIGHT_EPSILON) / Math.log(decay));
}

export function emaWarmupPrior(period: number): number {
  return Math.max(0, period - 1 + emaWarmupExtra(period));
}

export function rsiWarmupExtra(period: number): number {
  if (period <= 1) {
    return 0;
  }
  const decay = (period - 1) / period;
  return Math.ceil(Math.log(EMA_SEED_WEIGHT_EPSILON) / Math.log(decay));
}

export function rsiWarmupPrior(period: number): number {
  return Math.max(0, period + rsiWarmupExtra(period));
}

export function macdWarmupPrior(fastPeriod: number, slowPeriod: number, signalPeriod: number): number {
  return Math.max(emaWarmupPrior(fastPeriod), emaWarmupPrior(slowPeriod)) + emaWarmupPrior(signalPeriod);
}

export function warmupPriorFor(instance: IndicatorInstance): number {
  if (instance.type === "sma") {
    return smaWarmupPrior(instance.period);
  }
  if (instance.type === "ema") {
    return emaWarmupPrior(instance.period);
  }
  if (instance.type === "macd") {
    return macdWarmupPrior(
      instance.fastPeriod ?? 12,
      instance.slowPeriod ?? instance.period,
      instance.signalPeriod ?? 9,
    );
  }
  return rsiWarmupPrior(instance.period);
}

