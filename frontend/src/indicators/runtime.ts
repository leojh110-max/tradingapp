import { isCurrentRequest, nextRequestId } from "../utils/requestIdentity";
import type { Candle } from "../types/market";
import { computeInstance, sliceOutputToWindow } from "./engine";
import { calculationCandles } from "./instances";
import { getIndicatorDefinition } from "./registry";
import type { IndicatorInstance, IndicatorOutput } from "./types";

export const INDICATOR_CALC_ERROR = "Unable to calculate indicator";
export const INDICATOR_HISTORY_LOADING = "Loading indicator history...";

export type IndicatorComputation = {
  output: IndicatorOutput;
  error: string | null;
};

export function calculationFingerprint(instances: IndicatorInstance[]): string {
  return instances
    .map((instance) =>
      [
        instance.id,
        instance.type,
        instance.period,
        instance.source,
        instance.fastPeriod ?? "",
        instance.slowPeriod ?? "",
        instance.signalPeriod ?? "",
      ].join(":"),
    )
    .join("|");
}

export function indicatorRequestKey(input: {
  interval: string;
  firstOpenTime: number | null;
  lastOpenTime: number | null;
  length: number;
  fingerprint: string;
  cutoff: number | null;
}): string {
  return [
    input.interval,
    input.firstOpenTime ?? "",
    input.lastOpenTime ?? "",
    input.length,
    input.fingerprint,
    input.cutoff ?? "",
  ].join("|");
}

export function computeWindowOutputs(
  instances: IndicatorInstance[],
  displayed: Candle[],
  warmup: Candle[],
  cutoff: number | null = null,
): IndicatorComputation[] {
  const candles = calculationCandles(displayed, warmup);
  const displayedTimes = new Set(displayed.map((candle) => candle.openTime));
  return instances.map((instance) => {
    try {
      const full = computeInstance(instance, candles, cutoff);
      return {
        output: sliceOutputToWindow(full, displayedTimes),
        error: null,
      };
    } catch {
      return {
        output: { instanceId: instance.id, series: [] },
        error: INDICATOR_CALC_ERROR,
      };
    }
  });
}

export function nextIndicatorRequestId(current: number): number {
  return nextRequestId(current);
}

export function isCurrentIndicatorRequest(activeId: number, responseId: number): boolean {
  return isCurrentRequest(activeId, responseId);
}

export function loadingStatusMessage(instances: IndicatorInstance[]): string {
  let heaviest: IndicatorInstance | null = null;
  let heaviestPrior = -1;
  for (const instance of instances) {
    const prior = getIndicatorDefinition(instance.type)?.warmupPrior(instance) ?? instance.period;
    if (heaviest === null || prior > heaviestPrior) {
      heaviest = instance;
      heaviestPrior = prior;
    }
  }
  if (heaviest?.type === "macd") {
    return `Calculating MACD ${heaviest.fastPeriod ?? 12} ${heaviest.slowPeriod ?? heaviest.period} ${heaviest.signalPeriod ?? 9}…`;
  }
  if (heaviest && heaviest.period >= 100) {
    return `Calculating ${heaviest.type.toUpperCase()} ${heaviest.period}…`;
  }
  return INDICATOR_HISTORY_LOADING;
}
