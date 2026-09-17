import { divide, formatDecimal, fromInteger, parseDecimal } from "../utils/decimal";
import type { IndicatorValueKind } from "./types";

export const PRICE_DISPLAY_DECIMALS = 2;
export const OSCILLATOR_DISPLAY_DECIMALS = 2;
export const PRICE_DELTA_DISPLAY_DECIMALS = 2;
export const GENERIC_DISPLAY_DECIMALS = 2;

export function displayPlacesFor(valueKind: IndicatorValueKind): number {
  if (valueKind === "oscillator" || valueKind === "percentage") {
    return OSCILLATOR_DISPLAY_DECIMALS;
  }
  if (valueKind === "priceDelta") {
    return PRICE_DELTA_DISPLAY_DECIMALS;
  }
  if (valueKind === "generic") {
    return GENERIC_DISPLAY_DECIMALS;
  }
  return PRICE_DISPLAY_DECIMALS;
}

export function formatIndicatorValue(raw: string, valueKind: IndicatorValueKind): string {
  return formatFixedDecimal(raw, displayPlacesFor(valueKind));
}

export function formatFixedDecimal(raw: string, places: number): string {
  const rounded = divide(parseDecimal(raw), fromInteger(1), places);
  const text = formatDecimal(rounded);
  if (places <= 0) {
    return text;
  }
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  const [whole, fraction = ""] = body.split(".");
  const padded = `${whole}.${fraction.padEnd(places, "0").slice(0, places)}`;
  return negative ? `-${padded}` : padded;
}
