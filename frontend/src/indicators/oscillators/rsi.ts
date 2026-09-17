import {
  add,
  compare,
  divide,
  formatDecimal,
  fromInteger,
  isZero,
  multiply,
  parseDecimal,
  subtract,
  type DecimalValue,
} from "../../utils/decimal";
import { EMA_GUARD_DIGITS } from "../types";
import type { IndicatorPoint, IndicatorSample } from "../types";

const HUNDRED = fromInteger(100);
const ZERO = fromInteger(0);

export function calculateRsi(samples: IndicatorSample[], period: number): IndicatorPoint[] {
  if (period < 1) {
    throw new Error("period must be >= 1");
  }
  if (samples.length < period + 1) {
    return [];
  }
  const parsed = samples.map((sample) => parseDecimal(sample.source));
  const workScale = parsed.reduce((max, value) => Math.max(max, value.scale), 0) + EMA_GUARD_DIGITS;
  const periodDec = fromInteger(period);
  const periodMinus = fromInteger(period - 1);
  let gainSum = ZERO;
  let lossSum = ZERO;
  for (let index = 1; index <= period; index += 1) {
    const { gain, loss } = splitChange(parsed[index], parsed[index - 1]);
    gainSum = add(gainSum, gain);
    lossSum = add(lossSum, loss);
  }
  let avgGain = divide(gainSum, periodDec, workScale);
  let avgLoss = divide(lossSum, periodDec, workScale);
  const points: IndicatorPoint[] = [
    { openTime: samples[period].openTime, value: rsiFromAverages(avgGain, avgLoss, workScale) },
  ];
  for (let index = period + 1; index < samples.length; index += 1) {
    const { gain, loss } = splitChange(parsed[index], parsed[index - 1]);
    avgGain = divide(add(multiply(avgGain, periodMinus), gain), periodDec, workScale);
    avgLoss = divide(add(multiply(avgLoss, periodMinus), loss), periodDec, workScale);
    points.push({
      openTime: samples[index].openTime,
      value: rsiFromAverages(avgGain, avgLoss, workScale),
    });
  }
  return points;
}

function splitChange(current: DecimalValue, previous: DecimalValue): { gain: DecimalValue; loss: DecimalValue } {
  const change = subtract(current, previous);
  const cmp = compare(change, ZERO);
  if (cmp > 0) {
    return { gain: change, loss: ZERO };
  }
  if (cmp < 0) {
    return { gain: ZERO, loss: { sign: 1, coeff: change.coeff, scale: change.scale } };
  }
  return { gain: ZERO, loss: ZERO };
}

function rsiFromAverages(avgGain: DecimalValue, avgLoss: DecimalValue, workScale: number): string {
  const gainZero = isZero(avgGain);
  const lossZero = isZero(avgLoss);
  if (lossZero && !gainZero) {
    return "100";
  }
  if (gainZero && !lossZero) {
    return "0";
  }
  if (gainZero && lossZero) {
    return "50";
  }
  return formatDecimal(divide(multiply(HUNDRED, avgGain), add(avgGain, avgLoss), workScale));
}
