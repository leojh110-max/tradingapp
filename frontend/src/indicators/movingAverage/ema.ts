import { add, divide, formatDecimal, fromInteger, multiply, parseDecimal, type DecimalValue } from "../../utils/decimal";
import { EMA_GUARD_DIGITS } from "../types";
import type { IndicatorPoint, IndicatorSample } from "../types";

export type EmaValuePoint = {
  openTime: number;
  value: DecimalValue;
};

export function calculateEmaValues(samples: IndicatorSample[], period: number): EmaValuePoint[] {
  if (period < 1) {
    throw new Error("period must be >= 1");
  }
  if (samples.length < period) {
    return [];
  }
  const parsed = samples.map((sample) => parseDecimal(sample.source));
  const workScale = parsed.reduce((max, value) => Math.max(max, value.scale), 0) + EMA_GUARD_DIGITS;
  let seedSum = parsed[0];
  for (let index = 1; index < period; index += 1) {
    seedSum = add(seedSum, parsed[index]);
  }
  let previous = divide(seedSum, fromInteger(period), workScale);
  const points: EmaValuePoint[] = [{ openTime: samples[period - 1].openTime, value: previous }];
  const two = fromInteger(2);
  const periodMinus = fromInteger(period - 1);
  const periodPlus = fromInteger(period + 1);
  for (let index = period; index < samples.length; index += 1) {
    const numerator = add(multiply(two, parsed[index]), multiply(periodMinus, previous));
    previous = divide(numerator, periodPlus, workScale);
    points.push({
      openTime: samples[index].openTime,
      value: previous,
    });
  }
  return points;
}

export function calculateEma(samples: IndicatorSample[], period: number): IndicatorPoint[] {
  return calculateEmaValues(samples, period).map((point) => ({
    openTime: point.openTime,
    value: formatDecimal(point.value),
  }));
}
