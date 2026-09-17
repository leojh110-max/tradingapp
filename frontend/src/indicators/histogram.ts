import { isZero, parseDecimal } from "../utils/decimal";
import { MACD_HIST_ZERO_COLOR } from "./types";

export type HistogramPolarity = "positive" | "negative" | "zero";

export function histogramPolarity(value: string): HistogramPolarity {
  const parsed = parseDecimal(value);
  if (isZero(parsed)) {
    return "zero";
  }
  return parsed.sign === -1 ? "negative" : "positive";
}

export function histogramBarColor(
  value: string,
  colors: { positive: string; negative: string; zero?: string },
): string {
  const polarity = histogramPolarity(value);
  if (polarity === "positive") {
    return colors.positive;
  }
  if (polarity === "negative") {
    return colors.negative;
  }
  return colors.zero ?? MACD_HIST_ZERO_COLOR;
}
