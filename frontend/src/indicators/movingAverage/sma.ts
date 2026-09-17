import { add, divide, formatDecimal, fromInteger, parseDecimal, type DecimalValue } from "../../utils/decimal";
import type { IndicatorPoint, IndicatorSample } from "../types";

export function calculateSma(samples: IndicatorSample[], period: number): IndicatorPoint[] {
  if (period < 1) {
    throw new Error("period must be >= 1");
  }
  const values = samples.map((sample) => parseDecimal(sample.source));
  const scale = values.reduce((max, value) => Math.max(max, value.scale), 0);
  const points: IndicatorPoint[] = [];
  let sum: DecimalValue | null = null;
  for (let index = 0; index < values.length; index += 1) {
    sum = sum === null ? values[index] : add(sum, values[index]);
    if (index >= period) {
      sum = add(sum, negate(values[index - period]));
    }
    if (index >= period - 1 && sum !== null) {
      points.push({
        openTime: samples[index].openTime,
        value: formatDecimal(divide(sum, fromInteger(period), Math.max(scale, sum.scale))),
      });
    }
  }
  return points;
}

function negate(value: DecimalValue): DecimalValue {
  if (value.coeff === 0n) {
    return value;
  }
  return { sign: value.sign === 1 ? -1 : 1, coeff: value.coeff, scale: value.scale };
}
